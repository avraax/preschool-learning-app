// Byggeklodser's 3D scene (Krea PRD-03 §4.1) — three.js, imperative, OUTSIDE React. The pure world
// (`blockWorld.ts`) is the truth; this is only its picture, so a lost GPU context rebuilds from it.
//
// The rules this file exists to keep:
//   - ONE WebGLRenderer per game mount (several contexts on iOS is the memory-crash path).
//   - RENDER ON DEMAND. Nothing here runs a continuous requestAnimationFrame loop: a state change, a
//     camera move or a resize asks for ONE frame (`requestRender`), and an animation runs frames only
//     until it ends. The app at rest costs ~0 (`animation-and-performance.md`), measured by the frame
//     counter this class publishes on the canvas (`data-blocks-frames`).
//   - DPR capped (`DPR_CAP`), the one tuning constant for heat on the A10X.
//   - dispose() releases everything, and the canvas goes 0×0 — the renderer is created in an effect,
//     never in render (StrictMode's dev double-mount, the trap Farvelæg hit).
//
// The look (owner, 2026-11-06): the plate rests on a calm STUDIO floor that fades into the wall — no
// floating island, no painted landscape, ONE plain plate (2026-11-07, J8PYR: no themes). Doors (1×2) and
// windows are thin panels, set into a wall or standing on their own; there are no wheels and no roofs.
//
// Imports name `three` core classes one by one — never `import * as THREE`, never the addons barrel —
// and the whole module is reached only through the lazy `/krea/klodser` route (`blocks.test.ts`).

import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  HemisphereLight,
  DirectionalLight,
  AmbientLight,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  BoxGeometry,
  PlaneGeometry,
  BufferGeometry,
  CanvasTexture,
  Matrix4,
  Color,
  Fog,
  Raycaster,
  Vector2,
  Vector3,
  NearestFilter,
  PCFSoftShadowMap,
  SRGBColorSpace,
  DynamicDrawUsage,
  type Material,
  type Texture,
  type Object3D,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { DOOR_H, DOOR_W, MATERIAL_KINDS, isMaterial, type Block, type BlockKind, type Cell, type MaterialKind, type Target } from '../blockWorld.ts'
import { BLOCK_PLATE, BLOCK_STUDIO } from '../../../../config/kreaBlocks.ts'
import { facingAngle } from './geometry.ts'
import { clayNormalMap, loadTexture, materialTexture } from './textures.ts'
import { CAMERA, cameraPosition, fitBox, lerpPose, type Pose } from '../cameraRig.ts'
import { CRAYON_HEX } from '../../canvas/brushes.ts'

/** Device-pixel cap (§4.1). 2 is the iPad's own; the spike may lower it to 1.5 if the A10X runs hot. */
export const DPR_CAP = 2
/** Edge rounding as a share of a cell (§4.7: ≈ 0.08). */
const RADIUS = 0.08
/** The plate's clay slab, resting on the studio floor. */
const SLAB_DEPTH = 0.6
/** The camera always looks here: the plate's centre, a little above its top (§2.3: no panning). */
const TARGET = { x: 0, y: 0.5, z: 0 }
/** Window and door panels: thin slabs, framed in these colours on their edges. */
const PANEL_DEPTH = 0.16
/** Panels hang at the BACK of their cell, against whatever they were tapped onto (owner QHYV8: nothing
 * replaces a block any more, so a window tapped onto a wall must sit ON the wall, not a cell in front). */
const PANEL_OUT = -(0.5 - PANEL_DEPTH / 2 - 0.01)
const WINDOW_FRAME = '#F2EEE6'
const DOOR_FRAME = '#6B4423'
/** How strongly the seeded clay grain bends the light. Subtle (owner: "subtle clay"). */
const CLAY_GRAIN = 0.18

export type FaceArt = { window: string; door: string }

/**
 * One instanced mesh and the cells its instances draw, so a raycast hit (mesh + instanceId) maps back to
 * the world. Each block shape lives in one of these; a whole plate of blocks is a handful of draws.
 */
class Layer {
  cells: Cell[] = []
  constructor(readonly mesh: InstancedMesh, readonly pickable: boolean) {
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.count = 0
    mesh.castShadow = true
    mesh.receiveShadow = true
    // Instances move inside the plate's box, so the mesh's own bounds never decide culling.
    mesh.frustumCulled = false
  }
  begin(): void {
    this.cells = []
  }
  add(cell: Cell, m: Matrix4, color?: Color): void {
    const i = this.cells.length
    this.mesh.setMatrixAt(i, m)
    if (color) this.mesh.setColorAt(i, color)
    this.cells.push(cell)
  }
  commit(): void {
    this.mesh.count = this.cells.length
    // three CACHES an instanced mesh's bounds on its first raycast — with an empty plate that is an
    // empty sphere, and every later tap misses every block (measured: the eraser could hit nothing).
    this.mesh.computeBoundingSphere()
    this.mesh.computeBoundingBox()
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }
}

/** The squares as a checker (owner JYJ5F: the thin lines were hard to see). One texel per cell, crisp. */
function checkerTexture(n: number): Texture {
  const c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')!
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    g.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0)'
    g.fillRect(x, y, 1, 1)
  }
  const t = new CanvasTexture(c)
  t.magFilter = t.minFilter = NearestFilter
  t.generateMipmaps = false
  return t
}

export interface BlockSceneOptions {
  canvas: HTMLCanvasElement
  islandSize: number
  heightCap: number
  /** The owner's window and door renders (URLs). */
  faces: FaceArt
  /** The GPU went away: show the static studio; the world state is untouched. */
  onContextLost?: () => void
  /** The GPU came back: the caller re-applies the world (`setBlocks`) and the pose. */
  onContextRestored?: () => void
}

export class BlockScene {
  readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(CAMERA.fovDeg, 1, 0.1, 400)
  private readonly raycaster = new Raycaster()
  private readonly cubeGeo: RoundedBoxGeometry
  private readonly cubeMat: MeshStandardMaterial
  private readonly cubes: Layer
  private readonly windows: Layer
  /** One layer per material box: its painted surface on the rounded cube. */
  private readonly materials: Record<MaterialKind, Layer>
  private readonly doors: Layer
  private readonly layers: Layer[]
  private readonly textures: Texture[] = []
  private readonly island: Mesh
  private readonly ghosts: Mesh[]
  private readonly key: DirectionalLight
  private readonly half: number
  private readonly canvas: HTMLCanvasElement
  private pose: Pose = { ...CAMERA.home }
  private fit = 10
  private width = 1
  private height = 1
  /** CSS px of the stage covered by floating controls (header, panel): the plate centres in the rest. */
  private insets = { top: 0, right: 0, bottom: 0, left: 0 }
  private pending = 0
  private animation = 0
  private disposed = false
  private lost = false
  /** Frames actually drawn since mount — the render-on-demand evidence (`data-blocks-frames`). */
  frames = 0
  private readonly onLost: (e: Event) => void
  private readonly onRestored: () => void

  constructor(private readonly opts: BlockSceneOptions) {
    const { canvas, islandSize, heightCap } = opts
    this.canvas = canvas
    this.half = (islandSize - 1) / 2
    // preserveDrawingBuffer: the feedback screenshot (snapdom) copies this canvas LATER than the frame,
    // and a cleared buffer came out as empty sky (owner's report F6FB9). Rendering only on demand, the
    // extra copy it costs happens only when a frame is drawn at all.
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'default' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP))
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    // The key light never moves with the camera, so the shadow map changes ONLY when the blocks do:
    // `setBlocks` re-arms it. Redrawing it every frame of a turn doubled the per-frame draw work.
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.shadowMap.needsUpdate = true

    // ----- the studio: a plain wall colour, and a floor that fades into it (fog), so there is no horizon
    this.scene.background = new Color(BLOCK_STUDIO.wall)
    this.scene.fog = new Fog(BLOCK_STUDIO.wall, 40, 120)
    const floor = new Mesh(new PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new MeshStandardMaterial({ color: BLOCK_STUDIO.floor, roughness: 1, metalness: 0 }))
    floor.position.y = -SLAB_DEPTH
    floor.receiveShadow = true
    floor.name = 'floor'
    this.scene.add(floor)

    // ----- light: hemisphere + one key from the top-left (the art style's key light) + one soft shadow
    this.scene.add(new HemisphereLight(0xfffaf0, 0x9a8a76, 1.5))
    this.scene.add(new AmbientLight(0xffffff, 0.3))
    this.key = new DirectionalLight(0xffffff, 1.5)
    const reach = islandSize * 0.95 + heightCap * 0.4
    this.key.position.set(-islandSize * 0.6, islandSize * 1.3 + heightCap, islandSize * 0.5)
    this.key.castShadow = true
    this.key.shadow.mapSize.set(1024, 1024)
    this.key.shadow.radius = 5
    this.key.shadow.bias = -0.0006
    this.key.shadow.normalBias = 0.02
    Object.assign(this.key.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.5, far: islandSize * 4 + heightCap * 2 })
    this.key.shadow.camera.updateProjectionMatrix()
    this.scene.add(this.key)

    // ----- the plate: a clay slab resting on the floor (it casts its own soft shadow onto it). Per-face
    // materials: [+x, −x, +y top, −y bottom, +z, −z].
    const span = islandSize + 0.4
    const topMat = new MeshStandardMaterial({ color: BLOCK_PLATE.top, roughness: 0.95, metalness: 0 })
    const s = new MeshStandardMaterial({ color: BLOCK_PLATE.side, roughness: 0.95, metalness: 0 })
    const bottomMat = new MeshStandardMaterial({ color: BLOCK_PLATE.bottom, roughness: 1, metalness: 0 })
    this.island = new Mesh(new RoundedBoxGeometry(span, SLAB_DEPTH, span, 3, 0.18), [s, s, topMat, bottomMat, s, s])
    this.island.position.y = -SLAB_DEPTH / 2
    this.island.receiveShadow = true
    this.island.castShadow = true
    this.island.name = 'island'
    this.scene.add(this.island)

    // ----- the squares: a checker a hair above the top, DARKER than the plate (research 2026-11-07: a
    // faint light grid on a pale plate was the hard-to-see one, JYJ5F)
    const chk = checkerTexture(islandSize)
    this.textures.push(chk)
    const checker = new Mesh(
      new PlaneGeometry(islandSize, islandSize).rotateX(-Math.PI / 2).translate(0, 0.006, 0),
      new MeshBasicMaterial({ map: chk, color: BLOCK_PLATE.checker, opacity: BLOCK_PLATE.checkerAlpha, transparent: true, depthWrite: false }),
    )
    checker.name = 'checker'
    this.scene.add(checker)

    // ----- the blocks: one instanced mesh per SHAPE, colour per instance, a shared seeded clay grain
    const redraw = () => this.requestRender()
    const grain = clayNormalMap()
    const wTex = loadTexture(opts.faces.window, redraw)
    const dTex = loadTexture(opts.faces.door, redraw)
    this.textures.push(grain, wTex, dTex)
    const clay = (extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) =>
      new MeshStandardMaterial({ roughness: 0.88, metalness: 0, normalMap: grain, normalScale: new Vector2(CLAY_GRAIN, CLAY_GRAIN), ...extra })
    this.cubeGeo = new RoundedBoxGeometry(1, 1, 1, 2, RADIUS)
    this.cubeMat = clay()
    const capacity = islandSize * islandSize * heightCap
    const inst = (geo: BufferGeometry, mat: Material | Material[], colored: boolean) => {
      const m = new InstancedMesh(geo, mat, capacity)
      if (colored) m.setColorAt(0, new Color(1, 1, 1))
      return m
    }
    // Panels: the render on the two big faces, a clay frame colour on the edges. Box groups are
    // [+x, −x, +y, −y, +z, −z], so the faces are the last two.
    const panel = (frame: string, face: Texture) => {
      const edge = clay({ color: frame })
      const front = new MeshStandardMaterial({ map: face, roughness: 0.8, metalness: 0 })
      return [edge, edge, edge, edge, front, front]
    }
    this.cubes = new Layer(inst(this.cubeGeo, this.cubeMat, true), true)
    this.windows = new Layer(inst(new BoxGeometry(0.98, 0.98, PANEL_DEPTH).translate(0, 0, PANEL_OUT), panel(WINDOW_FRAME, wTex), false), true)
    // A door spans 2×3 cells (owner 6BC2N): drawn once from its anchor (bottom-left from the front), so the
    // shape reaches one cell to the local right (+x) and two up.
    this.doors = new Layer(inst(new BoxGeometry(DOOR_W - 0.1, DOOR_H - 0.04, PANEL_DEPTH).translate((DOOR_W - 1) / 2, (DOOR_H - 1) / 2, PANEL_OUT), panel(DOOR_FRAME, dTex), false), true)
    const mats = {} as Record<MaterialKind, Layer>
    for (const k of MATERIAL_KINDS) {
      const map = materialTexture(k)
      this.textures.push(map)
      const glass = k === 'glass'
      const mat = glass
        ? new MeshStandardMaterial({ map, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.6, depthWrite: false })
        : clay({ map, roughness: k === 'metal' ? 0.45 : 0.85, metalness: k === 'metal' ? 0.35 : 0 })
      const layer = new Layer(inst(this.cubeGeo, mat, false), true)
      // Glass lets the light through: no hard shadow under a see-through box.
      if (glass) layer.mesh.castShadow = false
      mats[k] = layer
    }
    this.materials = mats
    this.layers = [this.cubes, ...MATERIAL_KINDS.map((k) => mats[k]), this.windows, this.doors]
    for (const l of this.layers) this.scene.add(l.mesh)

    // ----- the ghosts: where a block would land (a door needs two), or what the eraser would take
    this.ghosts = Array.from({ length: DOOR_W * DOOR_H }, () => {
      const g = new Mesh(this.cubeGeo, new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }))
      g.visible = false
      g.renderOrder = 2
      this.scene.add(g)
      return g
    })

    // ----- context loss (§4.1): preventDefault so it CAN come back; truth stays in the pure world
    this.onLost = (ev: Event) => {
      ev.preventDefault()
      this.lost = true
      cancelAnimationFrame(this.pending)
      this.pending = 0
      opts.onContextLost?.()
    }
    this.onRestored = () => {
      this.lost = false
      opts.onContextRestored?.()
      this.requestRender()
    }
    canvas.addEventListener('webglcontextlost', this.onLost, false)
    canvas.addEventListener('webglcontextrestored', this.onRestored, false)
  }

  private centre(c: Cell): Vector3 {
    return new Vector3(c.x - this.half, c.y + 0.5, c.z - this.half)
  }

  /** Redraw the blocks from the world. */
  setBlocks(list: { cell: Cell; block: Block }[]): void {
    const m = new Matrix4()
    const col = new Color()
    for (const l of this.layers) l.begin()
    for (const { cell, block } of list) {
      if (block.anchor) continue // a door is drawn once, from its anchor
      const p = this.centre(cell)
      // Turn the +z-facing shape to the block's facing, then move it to its cell.
      m.makeRotationY(facingAngle(block.facing)).setPosition(p.x, p.y, p.z)
      switch (block.kind as BlockKind) {
        case 'cube':
          this.cubes.add(cell, m, col.set(CRAYON_HEX[block.color]))
          break
        case 'window':
          this.windows.add(cell, m)
          break
        case 'door':
          this.doors.add(cell, m)
          break
        default:
          if (isMaterial(block.kind)) this.materials[block.kind].add(cell, m)
      }
    }
    for (const l of this.layers) l.commit()
    this.renderer.shadowMap.needsUpdate = true
    this.requestRender()
  }

  /**
   * Show where a block would land (one cell, or a door's two), or what the eraser would take — or hide
   * it (null). `tint` is the colour the ghost wears.
   */
  setGhost(cells: Cell[] | null, tint: string | null): void {
    let changed = false
    this.ghosts.forEach((g, i) => {
      const c = cells?.[i]
      if (!c || !tint) {
        if (g.visible) changed = true
        g.visible = false
        return
      }
      const p = this.centre(c)
      const mat = g.material as MeshBasicMaterial
      if (!g.visible || !g.position.equals(p) || mat.color.getHexString() !== new Color(tint).getHexString()) changed = true
      g.position.copy(p)
      mat.color.set(tint)
      g.visible = true
    })
    if (changed) this.requestRender()
  }

  getPose(): Pose {
    return { ...this.pose }
  }

  setPose(p: Pose): void {
    this.stopAnimation()
    this.applyPose(p)
  }

  private applyPose(p: Pose): void {
    this.pose = { ...p }
    const target = TARGET
    const c = cameraPosition(p, target, this.fit)
    this.camera.position.set(c.x, c.y, c.z)
    this.camera.lookAt(target.x, target.y, target.z)
    this.requestRender()
  }

  /** Ease to a pose over `ms` — frames run only for the length of the move. */
  animateTo(to: Pose, ms: number = CAMERA.stepMs, done?: () => void): void {
    this.stopAnimation()
    const from = this.getPose()
    const t0 = performance.now()
    const tick = (now: number) => {
      if (this.disposed) return
      const t = Math.min(1, (now - t0) / ms)
      this.pose = lerpPose(from, to, t)
      this.applyPose(this.pose)
      if (t < 1) this.animation = requestAnimationFrame(tick)
      else {
        this.animation = 0
        this.pose = { ...to }
        done?.()
      }
    }
    this.animation = requestAnimationFrame(tick)
  }

  get animating(): boolean {
    return this.animation !== 0
  }

  private stopAnimation(): void {
    if (this.animation) cancelAnimationFrame(this.animation)
    this.animation = 0
  }

  /** The stage's CSS size changed: buffer = CSS × DPR (≤ cap), the camera re-fits the plate (§4.13). */
  resize(cssW: number, cssH: number): void {
    this.width = Math.max(1, Math.round(cssW))
    this.height = Math.max(1, Math.round(cssH))
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP))
    this.renderer.setSize(this.width, this.height, false)
    this.refit()
  }

  /**
   * The stage is the whole screen with controls floating over it (owner 2026-11-06). Tell the scene
   * which edges they cover: the plate is fitted to, and centred in, the free rectangle — the canvas still
   * draws (and picks) under the controls, so a turned or zoomed build never ends at a hard edge.
   */
  setInsets(i: { top: number; right: number; bottom: number; left: number }): void {
    const n = { top: Math.max(0, i.top), right: Math.max(0, i.right), bottom: Math.max(0, i.bottom), left: Math.max(0, i.left) }
    if (n.top === this.insets.top && n.right === this.insets.right && n.bottom === this.insets.bottom && n.left === this.insets.left) return
    this.insets = n
    this.refit()
  }

  private refit(): void {
    const { width: w, height: h, insets: i } = this
    const aspect = w / h
    this.camera.aspect = aspect
    // Shift the image so the look-at point lands on the free rectangle's centre (setViewOffset with a
    // full-size window is a pure translation of the projection; raycasting honours it).
    this.camera.setViewOffset(w, h, (i.right - i.left) / 2, (i.bottom - i.top) / 2, w, h)
    this.camera.updateProjectionMatrix()
    const fill = { x: 0.92 * Math.max(0.2, (w - i.left - i.right) / w), y: 0.92 * Math.max(0.2, (h - i.top - i.bottom) / h) }
    // The plate (its slab, plus two layers of building) fills the free area at zoom 1, judged from the
    // starting angle — so the fit never changes while the child turns (no pulsing plate).
    this.fit = fitBox(CAMERA.home, { half: this.opts.islandSize / 2 + 0.2, bottom: -SLAB_DEPTH, top: 2 }, TARGET, aspect, fill)
    // The floor fades into the wall well beyond the plate at every zoom, so there is no horizon line.
    const fog = this.scene.fog as Fog
    fog.near = this.fit * (CAMERA.zoomMax + 0.4)
    fog.far = this.fit * (CAMERA.zoomMax + 2.2)
    this.applyPose(this.pose)
  }

  /**
   * Where a point of a cell lands on the stage, in CSS px (probe aid: rung 1/2 drivers aim at real squares
   * instead of guessing). `fy` 0 = the cell's floor, 1 = its top; x/z are the cell's centre.
   */
  project(c: Cell, fy = 0): { x: number; y: number } {
    const p = this.centre(c)
    p.y += fy - 0.5
    p.project(this.camera)
    return { x: ((p.x + 1) / 2) * this.width, y: ((1 - p.y) / 2) * this.height }
  }

  /**
   * What a stage point (CSS px inside the canvas) lands on: a block's face, or the plate's top. Null over
   * the studio, the plate's sides or nothing at all.
   */
  pick(x: number, y: number): Target | null {
    const ndc = new Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    const pickable = this.layers.filter((l) => l.pickable)
    const hits = this.raycaster.intersectObjects([...pickable.map((l) => l.mesh), this.island] as Object3D[], false)
    const m = new Matrix4()
    for (const h of hits) {
      const layer = pickable.find((l) => l.mesh === h.object)
      if (layer && h.instanceId !== undefined && h.face) {
        let cell = layer.cells[h.instanceId]
        if (!cell) continue
        // The face normal is in the SHAPE's frame: turn it by the instance's rotation (a door facing west
        // is a rotated panel). The resolver still rounds it to one axis (rounded edges skew it).
        layer.mesh.getMatrixAt(h.instanceId, m)
        const n = h.face.normal.clone().transformDirection(m)
        // A door is ONE mesh over six cells: the cell is wherever the hit lies (a hair inside the face).
        if (layer === this.doors) {
          const q = h.point.clone().addScaledVector(n, -0.02)
          cell = { x: Math.round(q.x + this.half), y: Math.floor(q.y), z: Math.round(q.z + this.half) }
        }
        return { on: 'block', cell, normal: { x: n.x, y: n.y, z: n.z } }
      }
      if (h.object === this.island) {
        if (h.point.y < -0.05) return null // a side of the slab, not its top
        const cx = Math.floor(h.point.x + this.half + 0.5)
        const cz = Math.floor(h.point.z + this.half + 0.5)
        return { on: 'island', x: cx, z: cz }
      }
    }
    return null
  }

  /** Ask for ONE frame. Many asks inside one frame collapse to one draw. */
  requestRender(): void {
    if (this.pending || this.disposed || this.lost) return
    this.pending = requestAnimationFrame(() => {
      this.pending = 0
      this.render()
    })
  }

  private render(): void {
    if (this.disposed || this.lost) return
    this.renderer.render(this.scene, this.camera)
    this.frames++
    this.canvas.dataset.blocksFrames = String(this.frames)
  }

  /** Everything goes: geometries, materials, the renderer, the context, the buffer (§4.1). */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.pending)
    this.stopAnimation()
    this.canvas.removeEventListener('webglcontextlost', this.onLost, false)
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored, false)
    // three (r186) keeps ONE module-level texture, the DFG lookup table every MeshStandardMaterial
    // samples. Each renderer that uploads it adds a `dispose` listener to it, and renderer.dispose() never
    // removes that — so every closed game (renderer, programs, GL context) stayed reachable from the
    // module (heap snapshot: one WebGL2 context + two shader strings per open). Dispatching its dispose
    // makes every renderer drop it; the next renderer simply uploads it again.
    const props = this.renderer.properties.get(this.cubeMat) as { uniforms?: { dfgLUT?: { value?: Texture | null } } }
    props.uniforms?.dfgLUT?.value?.dispose()
    this.scene.traverse((o) => {
      const mesh = o as Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    for (const l of this.layers) l.mesh.dispose()
    // Materials don't own their maps: the grain, the faces and the checker go explicitly.
    for (const t of this.textures) t.dispose()
    this.key.shadow.map?.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.canvas.width = 0
    this.canvas.height = 0
  }
}
