import React, { useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, Sphere, Stars, Float, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

interface ThreeDComponentsProps {
  onNavigate: (route: string) => void
  onError: (error: Error) => void
  onLoaded: () => void
}

// 3D Planet component
const Planet = ({ position, color, size, speed, children }: any) => {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += speed
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1
    }
  })

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <Sphere ref={meshRef} position={position} args={[size, 32, 32]}>
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
        {children}
      </Sphere>
    </Float>
  )
}

// Interactive 3D Text
const FloatingText = ({ position, text, onClick }: any) => {
  const textRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (textRef.current) {
      textRef.current.rotation.y = Math.sin(state.clock.elapsedTime) * 0.2
    }
  })

  return (
    <Float speed={3} rotationIntensity={0.3} floatIntensity={0.8}>
      <Text
        ref={textRef}
        position={position}
        fontSize={0.5}
        color="#FFD700"
        anchorX="center"
        anchorY="middle"
        font="/fonts/ComicNeue-Bold.ttf"
        onClick={onClick}
        onPointerEnter={() => document.body.style.cursor = 'pointer'}
        onPointerLeave={() => document.body.style.cursor = 'default'}
      >
        {text}
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.3} />
      </Text>
    </Float>
  )
}

// Animated Rocket
const Rocket = () => {
  const rocketRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (rocketRef.current) {
      rocketRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.8) * 2
      rocketRef.current.position.y = Math.cos(state.clock.elapsedTime * 0.6) * 1
      rocketRef.current.rotation.z = Math.sin(state.clock.elapsedTime) * 0.2
    }
  })

  return (
    <group ref={rocketRef} position={[0, 0, -2]}>
      {/* Rocket Body */}
      <mesh>
        <cylinderGeometry args={[0.1, 0.2, 0.8, 8]} />
        <meshStandardMaterial color="#FF4444" />
      </mesh>
      {/* Rocket Tip */}
      <mesh position={[0, 0.5, 0]}>
        <coneGeometry args={[0.1, 0.3, 8]} />
        <meshStandardMaterial color="#FFD700" />
      </mesh>
      {/* Rocket Fins */}
      <mesh position={[0.15, -0.3, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.2, 0.05, 0.1]} />
        <meshStandardMaterial color="#4444FF" />
      </mesh>
      <mesh position={[-0.15, -0.3, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.2, 0.05, 0.1]} />
        <meshStandardMaterial color="#4444FF" />
      </mesh>
    </group>
  )
}

// 3D Scene Component
const SpaceScene = ({ onNavigate }: { onNavigate: (route: string) => void }) => {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <directionalLight position={[5, 5, 5]} intensity={0.5} />

      {/* Background Stars */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />

      {/* Planets */}
      <Planet position={[-3, 1, -4]} color="#FF6B6B" size={0.8} speed={0.01} />
      <Planet position={[3, -1, -5]} color="#4ECDC4" size={0.6} speed={0.015} />
      <Planet position={[0, 2, -6]} color="#45B7D1" size={1.0} speed={0.008} />
      <Planet position={[-2, -2, -3]} color="#96CEB4" size={0.4} speed={0.02} />
      <Planet position={[4, 0, -7]} color="#FFEAA7" size={0.7} speed={0.012} />

      {/* Interactive Navigation */}
      <FloatingText
        position={[-2, 0, 0]}
        text="📚 Bogstaver"
        onClick={() => onNavigate('/alphabet')}
      />
      <FloatingText
        position={[2, 0, 0]}
        text="🔢 Tal"
        onClick={() => onNavigate('/math')}
      />
      <FloatingText
        position={[0, 1.5, 0]}
        text="🎨 Farver"
        onClick={() => onNavigate('/farver')}
      />
      <FloatingText
        position={[0, -1.5, 0]}
        text="🧠 Hukommelse"
        onClick={() => onNavigate('/memory')}
      />

      {/* Animated Rocket */}
      <Rocket />

      {/* Orbit Controls for interaction */}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        maxPolarAngle={Math.PI / 2}
        minPolarAngle={Math.PI / 2}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  )
}

const ThreeDComponents: React.FC<ThreeDComponentsProps> = ({ onNavigate, onError, onLoaded }) => {
  useEffect(() => {
    // Signal that 3D components loaded successfully
    onLoaded()
  }, [onLoaded])

  const handleCanvasError = (error: any) => {
    console.error('Canvas creation error:', error)
    onError(new Error(`Canvas error: ${error.message || 'Unknown error'}`))
  }

  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 75 }}
      style={{ width: '100%', height: '100%' }}
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
          
          console.log('✅ 3D Canvas initialized successfully')
        } catch (error) {
          console.error('❌ Canvas initialization failed:', error)
          onError(error as Error)
        }
      }}
      onError={handleCanvasError}
    >
      <SpaceScene onNavigate={onNavigate} />
    </Canvas>
  )
}

export default ThreeDComponents