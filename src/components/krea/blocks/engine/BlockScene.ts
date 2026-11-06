// Byggeklodser's 3D scene (Krea PRD-03 §4.1) — three.js, imperative, OUTSIDE React. The pure world
// (`blockWorld.ts`) is the truth; this is only its picture, so a lost GPU context rebuilds from it.
//
// The rules this file exists to keep:
//   - ONE WebGLRenderer per game mount (several contexts on iOS is the memory-crash path).
//   - RENDER ON DEMAND. Nothing here runs a continuous requestAnimationFrame loop: a state change, a
//     camera move or a resize asks for ONE frame (`requestRender`), and an animation (a 90° step) runs
//     frames only until it ends. The app at rest costs ~0 (`animation-and-performance.md`), measured by
//     the frame counter this class publishes on the canvas (`data-blocks-frames`).
//   - DPR capped (`DPR_CAP`), the one tuning constant for heat on the A10X.
//   - dispose() releases everything, and the canvas goes 0×0 — the renderer is created in an effect,
//     never in render (StrictMode's dev double-mount, the trap Farvelæg hit).
//
// Imports name `three` core classes one by one — never `import * as THREE`, never the addons barrel —
// and the whole module is reached only through the lazy `/krea/klodser` route (`blocksBundle.test.ts`).

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
  BufferGeometry,
  Float32BufferAttribute,
  LineSegments,
  LineBasicMaterial,
  Matrix4,
  Color,
  Raycaster,
  Vector2,
  Vector3,
  PCFSoftShadowMap,
  SRGBColorSpace,
  DynamicDrawUsage,
  type Texture,
  type Object3D,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { Block, BlockKind, Cell, Target } from '../blockWorld.ts'
import type { BlockIslandDef } from '../../../../config/kreaBlocks.ts'
import { facingAngle, faceGeometry, roofGeometry, WHEEL_SETBACK, wheelFaceGeometry, wheelGeometry } from './geometry.ts'
import { clayNormalMap, loadTexture } from './textures.ts'
import { CAMERA, cameraPosition, fitBox, lerpPose, type Pose } from '../cameraRig.ts'
import { CRAYON_HEX } from '../../canvas/brushes.ts'

/** Device-pixel cap (§4.1). 2 is the iPad's own; the spike may lower it to 1.5 if the A10X runs hot. */
export const DPR_CAP = 2
/** Edge rounding as a share of a cell (§4.7: ≈ 0.08). */
const RADIUS = 0.08
/** The island's clay slab: thick enough that its side render (a grass/snow/sand band over earth) reads. */
const SLAB_DEPTH = 1.2
/** The camera always looks here: the island's centre, a little above its top (§2.3: no panning). */
const TARGET = { x: 0, y: 0.5, z: 0 }
/** The fixed-look specials' bodies (§2.2.7): a white window frame, a brown door, a black tyre. */
const WINDOW_BODY = '#F2EEE6'
const DOOR_BODY = '#8A5A33'
const TYRE = '#2E2B2A'
/** How strongly the seeded clay grain bends the light. Subtle (owner: "subtle clay"). */
const CLAY_GRAIN = 0.18

/**
 * One instanced mesh and the cells its instances draw, so a raycast hit (mesh + instanceId) maps back to
 * the world. Each block KIND lives in one or two of these; a whole island of blocks is a handful of draws.
 */
class Layer {
  cells: Cell[] = []
  constructor(readonly mesh: InstancedMesh, readonly pickable: boolean) {
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.count = 0
    mesh.castShadow = true
    mesh.receiveShadow = true
    // Instances move inside the island's box, so the mesh's own bounds never decide culling.
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
    // three CACHES an instanced mesh's bounds on its first raycast — with an empty island that is an
    // empty sphere, and every later tap misses every block (measured: the eraser could hit nothing).
    this.mesh.computeBoundingSphere()
    this.mesh.computeBoundingBox()
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }
}

export interface BlockSceneOptions {
  canvas: HTMLCanvasElement
  islandSize: number
  heightCap: number
  /** Which island's clay and grid (the sky is the DOM behind the canvas). */
  island: BlockIslandDef
  /** The owner's renders (URLs): this island's top and side, and the specials' painted faces. */
  art: { top: string; side: string; window: string; door: string; wheel: string }
  /** The GPU went away: show the static sky; the world state is untouched. */
  onContextLost?: () => void
  /** The GPU came back: the caller re-applies the world (`setBlocks`) and the pose. */
  onContextRestored?: () => void
}

export class BlockScene {
  readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(CAMERA.fovDeg, 1, 0.1, 200)
  private readonly raycaster = new Raycaster()
  private readonly cubeGeo: RoundedBoxGeometry
  private readonly cubeMat: MeshStandardMaterial
  /** Cubes AND the window/door bodies (one shape, colour per instance). */
  private readonly cubes: Layer
  private readonly roofs: Layer
  private readonly tyres: Layer
  private readonly wheelFaces: Layer
  private readonly windowFaces: Layer
  private readonly doorFaces: Layer
  private readonly layers: Layer[]
  private readonly textures: Texture[] = []
  private readonly island: Mesh
  private readonly grid: LineSegments
  private readonly ghost: Mesh
  private readonly key: DirectionalLight
  private readonly half: number
  private readonly canvas: HTMLCanvasElement
  private pose: Pose = { ...CAMERA.home }
  private fit = 10
  private width = 1
  private height = 1
  /** CSS px of the stage covered by floating controls (header, panel): the island centres in the rest. */
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
    const { canvas, islandSize, heightCap, island, art } = opts
    this.canvas = canvas
    this.half = (islandSize - 1) / 2
    // preserveDrawingBuffer: the feedback screenshot (snapdom) copies this canvas LATER than the frame,
    // and a cleared buffer came out as empty sky (owner's report F6FB9). Rendering only on demand, the
    // extra copy it costs happens only when a frame is drawn at all.
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: 'default' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFSoftShadowMap
    // The key light never moves with the camera, so the shadow map changes ONLY when the blocks do:
    // `setBlocks` re-arms it. Redrawing it every frame of a turn doubled the per-frame draw work.
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.shadowMap.needsUpdate = true

    // ----- light: hemisphere + one key from the top-left (the art style's key light) + one soft shadow
    this.scene.add(new HemisphereLight(0xfffaf0, 0x8a7a66, 1.6))
    this.scene.add(new AmbientLight(0xffffff, 0.25))
    this.key = new DirectionalLight(0xffffff, 1.6)
    const reach = islandSize * 0.75 + heightCap * 0.3
    this.key.position.set(-islandSize * 0.6, islandSize * 1.3 + heightCap, islandSize * 0.5)
    this.key.castShadow = true
    this.key.shadow.mapSize.set(1024, 1024)
    this.key.shadow.radius = 4
    this.key.shadow.bias = -0.0006
    this.key.shadow.normalBias = 0.02
    Object.assign(this.key.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 0.5, far: islandSize * 4 + heightCap * 2 })
    this.key.shadow.camera.updateProjectionMatrix()
    this.scene.add(this.key)

    // ----- the island: a floating clay slab. The owner's top render is stretched once over the top (an
    // island is at most 16 a side, §4.7: no tiling), the side render's band runs round the edge, repeated
    // so its pebbles keep their shape. Per-face materials: [+x, −x, +y top, −y bottom, +z, −z].
    const redraw = () => this.requestRender()
    const span = islandSize + 0.4
    const top = loadTexture(art.top, redraw)
    const side = loadTexture(art.side, redraw, { x: Math.max(1, Math.round(span / SLAB_DEPTH)), y: 1 })
    this.textures.push(top, side)
    const topMat = new MeshStandardMaterial({ map: top, roughness: 0.95, metalness: 0 })
    const sideMat = new MeshStandardMaterial({ map: side, roughness: 0.95, metalness: 0 })
    const bottomMat = new MeshStandardMaterial({ color: island.soil, roughness: 1 })
    const slabGeo = new RoundedBoxGeometry(span, SLAB_DEPTH, span, 3, 0.25)
    this.island = new Mesh(slabGeo, [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat])
    this.island.position.y = -SLAB_DEPTH / 2
    this.island.receiveShadow = true
    this.island.name = 'island'
    this.scene.add(this.island)

    // ----- faint grid lines to aim by (§2.8), drawn in code, a hair above the top
    const pts: number[] = []
    const e = islandSize / 2
    for (let i = 0; i <= islandSize; i++) {
      const p = i - e
      pts.push(p, 0.004, -e, p, 0.004, e, -e, 0.004, p, e, 0.004, p)
    }
    const gridGeo = new BufferGeometry()
    gridGeo.setAttribute('position', new Float32BufferAttribute(pts, 3))
    this.grid = new LineSegments(gridGeo, new LineBasicMaterial({ color: island.grid, transparent: true, opacity: island.gridOpacity }))
    this.scene.add(this.grid)

    // ----- the blocks: one instanced mesh per SHAPE, colour per instance, a shared seeded clay grain
    const grain = clayNormalMap()
    const wTex = loadTexture(art.window, redraw)
    const dTex = loadTexture(art.door, redraw)
    const wheelTex = loadTexture(art.wheel, redraw)
    this.textures.push(grain, wTex, dTex, wheelTex)
    const clay = (extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {}) =>
      new MeshStandardMaterial({ roughness: 0.88, metalness: 0, normalMap: grain, normalScale: new Vector2(CLAY_GRAIN, CLAY_GRAIN), ...extra })
    this.cubeGeo = new RoundedBoxGeometry(1, 1, 1, 2, RADIUS)
    this.cubeMat = clay()
    const capacity = islandSize * islandSize * heightCap
    const inst = (geo: BufferGeometry, mat: MeshStandardMaterial, colored: boolean) => {
      const m = new InstancedMesh(geo, mat, capacity)
      if (colored) m.setColorAt(0, new Color(1, 1, 1))
      return m
    }
    this.cubes = new Layer(inst(this.cubeGeo, this.cubeMat, true), true)
    this.roofs = new Layer(inst(roofGeometry(), clay(), true), true)
    this.tyres = new Layer(inst(wheelGeometry(), clay({ color: TYRE, roughness: 0.95 }), false), true)
    this.wheelFaces = new Layer(inst(wheelFaceGeometry(), new MeshStandardMaterial({ map: wheelTex, roughness: 0.9, metalness: 0 }), false), true)
    // The painted faces sit on the bodies: not picked (a tap there hits the body behind, the same cell).
    this.windowFaces = new Layer(inst(faceGeometry(), new MeshStandardMaterial({ map: wTex, roughness: 0.6, metalness: 0 }), false), false)
    this.doorFaces = new Layer(inst(faceGeometry(), new MeshStandardMaterial({ map: dTex, roughness: 0.9, metalness: 0 }), false), false)
    this.windowFaces.mesh.castShadow = this.doorFaces.mesh.castShadow = false
    this.layers = [this.cubes, this.roofs, this.tyres, this.wheelFaces, this.windowFaces, this.doorFaces]
    for (const l of this.layers) this.scene.add(l.mesh)

    // ----- the ghost: where a dragged block would land
    this.ghost = new Mesh(this.cubeGeo, new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }))
    this.ghost.visible = false
    this.scene.add(this.ghost)

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
    const r = new Matrix4()
    const col = new Color()
    for (const l of this.layers) l.begin()
    for (const { cell, block } of list) {
      const p = this.centre(cell)
      // Turn the +z-facing shape to the block's facing, then move it to its cell.
      m.makeRotationY(facingAngle(block.facing)).setPosition(p.x, p.y, p.z)
      switch (block.kind as BlockKind) {
        case 'cube':
          this.cubes.add(cell, m, col.set(CRAYON_HEX[block.color]))
          break
        case 'roof':
          this.roofs.add(cell, m, col.set(CRAYON_HEX[block.color]))
          break
        case 'window':
          this.cubes.add(cell, m, col.set(WINDOW_BODY))
          this.windowFaces.add(cell, m)
          break
        case 'door':
          this.cubes.add(cell, m, col.set(DOOR_BODY))
          this.doorFaces.add(cell, m)
          break
        case 'wheel': {
          // Pulled back towards the block it hangs on, so it touches that face (§4.6: axle along it).
          r.makeTranslation(0, 0, -WHEEL_SETBACK)
          const w = m.clone().multiply(r)
          this.tyres.add(cell, w)
          this.wheelFaces.add(cell, w)
          break
        }
      }
    }
    for (const l of this.layers) l.commit()
    this.renderer.shadowMap.needsUpdate = true
    this.requestRender()
  }

  /** Show where a block would land, or hide the ghost (null). */
  setGhost(cell: Cell | null, block: { kind: BlockKind; color: Block['color'] } | null): void {
    const was = this.ghost.visible
    if (!cell || !block) {
      this.ghost.visible = false
      if (was) this.requestRender()
      return
    }
    const p = this.centre(cell)
    if (was && this.ghost.position.equals(p)) return
    this.ghost.position.copy(p)
    const look = block.kind === 'cube' || block.kind === 'roof' ? CRAYON_HEX[block.color] : block.kind === 'window' ? WINDOW_BODY : block.kind === 'door' ? DOOR_BODY : TYRE
    ;(this.ghost.material as MeshBasicMaterial).color.set(look)
    this.ghost.visible = true
    this.requestRender()
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

  /** Ease to a pose over `ms` (Let's 90° steps) — frames run only for the length of the move. */
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

  /** The stage's CSS size changed: buffer = CSS × DPR (≤ cap), the camera re-fits the island (§4.13). */
  resize(cssW: number, cssH: number): void {
    this.width = Math.max(1, Math.round(cssW))
    this.height = Math.max(1, Math.round(cssH))
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP))
    this.renderer.setSize(this.width, this.height, false)
    this.refit()
  }

  /**
   * The stage is the whole screen with controls floating over it (owner 2026-11-06). Tell the scene
   * which edges they cover: the island is fitted to, and centred in, the free rectangle — the canvas still
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
    // The island (its slab, plus two layers of building) fills the free area at zoom 1, judged from the
    // starting angle — so the fit never changes while the child turns (no pulsing island).
    this.fit = fitBox(CAMERA.home, { half: this.opts.islandSize / 2 + 0.2, bottom: -SLAB_DEPTH, top: 2 }, TARGET, aspect, fill)
    this.applyPose(this.pose)
  }

  /**
   * What a stage point (CSS px inside the canvas) lands on: a block's face, or the island's top. Null over
   * the sky, the island's sides or nothing at all.
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
        const cell = layer.cells[h.instanceId]
        if (!cell) continue
        // The face normal is in the SHAPE's frame: turn it by the instance's rotation (a roof facing west
        // is a rotated wedge). The resolver still rounds it to one axis (rounded edges skew it).
        layer.mesh.getMatrixAt(h.instanceId, m)
        const n = h.face.normal.clone().transformDirection(m)
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
    // Materials don't own their maps: the grain and the face textures go explicitly.
    for (const t of this.textures) t.dispose()
    this.key.shadow.map?.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.canvas.width = 0
    this.canvas.height = 0
  }
}
