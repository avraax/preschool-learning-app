import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Sphere, Box } from '@react-three/drei'
import { Mesh, Vector3 } from 'three'

// Floating planet component
const Planet = ({ position, color, size, speed, onClick, children }: {
  position: Vector3
  color: string
  size: number
  speed: number
  onClick?: () => void
  children?: React.ReactNode
}) => {
  const meshRef = useRef<Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += speed
      meshRef.current.position.y = position.y + Math.sin(state.clock.elapsedTime * 0.5) * 0.2
    }
  })

  return (
    <group position={position}>
      <Sphere
        ref={meshRef}
        args={[size, 32, 32]}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <meshStandardMaterial
          color={color}
          metalness={0.1}
          roughness={0.3}
          emissive={color}
          emissiveIntensity={0.2}
        />
      </Sphere>
      {children}
    </group>
  )
}

// Floating text component
const FloatingText = ({ text, position, color = "white", size = 1, onClick }: {
  text: string
  position: Vector3
  color?: string
  size?: number
  onClick?: () => void
}) => {
  const textRef = useRef<any>(null)

  useFrame((state) => {
    if (textRef.current) {
      textRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.1
      textRef.current.position.y = position.y + Math.sin(state.clock.elapsedTime * 0.7 + position.x) * 0.3
    }
  })

  return (
    <mesh
      ref={textRef}
      position={position}
      onClick={onClick}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto'
      }}
    >
      {/* Use basic Box geometry for text until we have proper font files */}
      <Box args={[size * text.length * 0.6, size, 0.1]}>
        <meshStandardMaterial
          color={color}
          metalness={0.1}
          roughness={0.3}
          emissive={color}
          emissiveIntensity={0.3}
        />
      </Box>
    </mesh>
  )
}

// Animated learning blocks
const LearningBlock = ({ position, color, onClick }: {
  position: Vector3
  color: string
  onClick?: () => void
}) => {
  const blockRef = useRef<Mesh>(null)

  useFrame((state) => {
    if (blockRef.current) {
      blockRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.2
      blockRef.current.rotation.z = Math.cos(state.clock.elapsedTime * 0.3) * 0.1
      blockRef.current.position.y = position.y + Math.sin(state.clock.elapsedTime * 0.8 + position.x * 2) * 0.4
    }
  })

  return (
    <group position={position}>
      <Box
        ref={blockRef}
        args={[1, 1, 1]}
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <meshStandardMaterial
          color={color}
          metalness={0.2}
          roughness={0.2}
        />
      </Box>
      <mesh position={[0, 0, 0.6]}>
        <Box args={[0.6, 0.6, 0.05]}>
          <meshStandardMaterial color="white" />
        </Box>
      </mesh>
    </group>
  )
}

interface SpaceScene3DProps {
  onNavigate: (route: string) => void
}

export const SpaceScene3D: React.FC<SpaceScene3DProps> = ({ onNavigate }) => {
  // Create learning elements
  const learningElements = useMemo(() => [
    // Planets for different learning categories
    {
      type: 'planet' as const,
      position: new Vector3(-4, 2, -2),
      color: '#FF6B6B',
      size: 0.8,
      speed: 0.01,
      onClick: () => onNavigate('/alphabet'),
      label: 'Alfabet'
    },
    {
      type: 'planet' as const,
      position: new Vector3(4, -1, -1),
      color: '#4ECDC4',
      size: 1,
      speed: 0.008,
      onClick: () => onNavigate('/math'),
      label: 'Matematik'
    },
    {
      type: 'planet' as const,
      position: new Vector3(-2, -3, 1),
      color: '#FFD700',
      size: 0.7,
      speed: 0.012,
      onClick: () => onNavigate('/farver'),
      label: 'Farver'
    },
    {
      type: 'planet' as const,
      position: new Vector3(3, 3, -3),
      color: '#96CEB4',
      size: 0.6,
      speed: 0.015,
      onClick: () => onNavigate('/memory'),
      label: 'Hukommelse'
    },
    // Floating learning blocks
    {
      type: 'block' as const,
      position: new Vector3(-6, 0, 2),
      color: '#9B59B6',
      onClick: () => onNavigate('/alphabet/learn')
    },
    {
      type: 'block' as const,
      position: new Vector3(6, 1, 1),
      color: '#3498DB',
      onClick: () => onNavigate('/math/counting')
    },
    // Floating text labels
    {
      type: 'text' as const,
      position: new Vector3(0, 4, -2),
      text: 'LÆRINGSRUM',
      color: '#FFFFFF',
      size: 0.8,
      onClick: () => {}
    }
  ], [onNavigate])

  return (
    <>
      {/* Background stars */}
      <Stars radius={300} depth={50} count={1000} factor={4} saturation={0} fade />
      
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4ECDC4" />

      {/* Camera controls */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={5}
        maxDistance={15}
        autoRotate={true}
        autoRotateSpeed={0.5}
      />

      {/* Render learning elements */}
      {learningElements.map((element, index) => {
        switch (element.type) {
          case 'planet':
            return (
              <Planet
                key={index}
                position={element.position}
                color={element.color}
                size={element.size}
                speed={element.speed}
                onClick={element.onClick}
              >
                <FloatingText
                  text={element.label || ''}
                  position={new Vector3(0, element.size + 0.5, 0)}
                  color={element.color}
                  size={0.3}
                />
              </Planet>
            )
          case 'block':
            return (
              <LearningBlock
                key={index}
                position={element.position}
                color={element.color}
                onClick={element.onClick}
              />
            )
          case 'text':
            return (
              <FloatingText
                key={index}
                text={element.text || ''}
                position={element.position}
                color={element.color}
                size={element.size}
                onClick={element.onClick}
              />
            )
          default:
            return null
        }
      })}
    </>
  )
}

export default SpaceScene3D