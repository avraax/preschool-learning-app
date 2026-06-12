import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, Box as ThreeBox, Sphere, Float, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { gsap } from 'gsap'

interface ToyboxThreeDComponentsProps {
  onNavigate: (route: string) => void
  onError: (error: Error) => void
  onLoaded: () => void
}

// 3D Toy Components
const ToyBlock = ({ position, color, letter, onClick }: any) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + position[0]) * 0.1
    }
  })

  useEffect(() => {
    if (meshRef.current) {
      if (hovered) {
        gsap.to(meshRef.current.scale, { duration: 0.3, x: 1.2, y: 1.2, z: 1.2 })
      } else {
        gsap.to(meshRef.current.scale, { duration: 0.3, x: 1, y: 1, z: 1 })
      }
    }
  }, [hovered])

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
      <ThreeBox
        ref={meshRef}
        position={position}
        args={[1, 1, 1]}
        onClick={onClick}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
        <Text
          position={[0, 0, 0.51]}
          fontSize={0.4}
          color="white"
          anchorX="center"
          anchorY="middle"
          font="/fonts/ComicNeue-Bold.ttf"
        >
          {letter}
        </Text>
      </ThreeBox>
    </Float>
  )
}

const ToyBall = ({ position, color, number }: any) => {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.02
      meshRef.current.rotation.z += 0.01
      meshRef.current.position.x = position[0] + Math.cos(state.clock.elapsedTime * 0.5) * 0.2
    }
  })

  return (
    <Float speed={1.5} rotationIntensity={0.4} floatIntensity={0.6}>
      <Sphere ref={meshRef} position={position} args={[0.4, 32, 32]}>
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.3} />
        <Text
          position={[0, 0, 0.41]}
          fontSize={0.3}
          color="white"
          anchorX="center"
          anchorY="middle"
          font="/fonts/ComicNeue-Bold.ttf"
        >
          {number}
        </Text>
      </Sphere>
    </Float>
  )
}

const ToyPlane = () => {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.3) * 3
      groupRef.current.position.y = Math.cos(state.clock.elapsedTime * 0.2) * 1 + 2
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.3) * 0.3
    }
  })

  return (
    <group ref={groupRef}>
      {/* Airplane body */}
      <ThreeBox position={[0, 0, 0]} args={[1, 0.2, 0.2]}>
        <meshStandardMaterial color="#FF6B6B" />
      </ThreeBox>
      {/* Wings */}
      <ThreeBox position={[0, 0, 0]} args={[0.2, 0.8, 0.1]}>
        <meshStandardMaterial color="#4ECDC4" />
      </ThreeBox>
      {/* Propeller */}
      <ThreeBox position={[0.6, 0, 0]} args={[0.1, 0.6, 0.05]} rotation={[0, 0, 0]}>
        <meshStandardMaterial color="#FFD700" />
      </ThreeBox>
    </group>
  )
}

// 3D Scene Component
const ToyboxScene = ({ onNavigate }: { onNavigate: (route: string) => void }) => {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />

      {/* Learning Blocks */}
      <ToyBlock
        position={[-2, 0, 0]}
        color="#FF6B6B"
        letter="A"
        onClick={() => onNavigate('/alphabet')}
      />
      <ToyBlock
        position={[2, 0, 0]}
        color="#4ECDC4"
        letter="1"
        onClick={() => onNavigate('/math')}
      />
      <ToyBlock
        position={[0, 1.5, -1]}
        color="#FFD700"
        letter="🎨"
        onClick={() => onNavigate('/farver')}
      />
      <ToyBlock
        position={[0, -1.5, -1]}
        color="#96CEB4"
        letter="🧠"
        onClick={() => onNavigate('/memory')}
      />

      {/* Floating Balls */}
      <ToyBall position={[-1, 2, -2]} color="#FD79A8" number="2" />
      <ToyBall position={[1, 2, -2]} color="#FDCB6E" number="3" />
      <ToyBall position={[-3, 1, -3]} color="#E17055" number="4" />
      <ToyBall position={[3, 1, -3]} color="#74B9FF" number="5" />

      {/* Flying Airplane */}
      <ToyPlane />

      {/* Toy Box Floor */}
      <ThreeBox position={[0, -3, 0]} args={[10, 0.5, 10]}>
        <meshStandardMaterial color="#DDA0DD" roughness={0.8} />
      </ThreeBox>

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={Math.PI / 4}
        autoRotate
        autoRotateSpeed={1}
      />
    </>
  )
}

const ToyboxThreeDComponents: React.FC<ToyboxThreeDComponentsProps> = ({ onNavigate, onError, onLoaded }) => {
  useEffect(() => {
    // Signal that 3D components loaded successfully
    onLoaded()
  }, [onLoaded])

  const handleCanvasError = (error: any) => {
    console.error('Toybox Canvas creation error:', error)
    onError(new Error(`Canvas error: ${error.message || 'Unknown error'}`))
  }

  return (
    <Canvas
      camera={{ position: [0, 2, 8], fov: 60 }}
      style={{ 
        width: '100%', 
        height: '100%'
      }}
      onCreated={({ gl }) => {
        try {
          // Verify WebGL context is available
          if (!gl.getContext()) {
            throw new Error('WebGL context unavailable')
          }
          
          // Test a simple WebGL operation
          const context = gl.getContext()
          if (context) {
            context.clear(context.COLOR_BUFFER_BIT)
          }
          
          console.log('✅ Toybox 3D Canvas initialized successfully')
        } catch (error) {
          console.error('❌ Toybox Canvas initialization failed:', error)
          onError(error as Error)
        }
      }}
      onError={handleCanvasError}
    >
      <ToyboxScene onNavigate={onNavigate} />
    </Canvas>
  )
}

export default ToyboxThreeDComponents