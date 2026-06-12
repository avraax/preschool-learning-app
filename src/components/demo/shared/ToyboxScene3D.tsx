import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, Box, Sphere, Cylinder } from '@react-three/drei'
import { Mesh, Vector3 } from 'three'

// Animated toy component
const AnimatedToy = ({ 
  position, 
  geometry, 
  color, 
  title, 
  onClick,
  animationType = 'float'
}: {
  position: Vector3
  geometry: 'box' | 'sphere' | 'cylinder'
  color: string
  title: string
  onClick?: () => void
  animationType?: 'float' | 'rotate' | 'bounce'
}) => {
  const toyRef = useRef<Mesh>(null)
  const textRef = useRef<any>(null)

  useFrame((state) => {
    if (!toyRef.current || !textRef.current) return

    const time = state.clock.elapsedTime

    switch (animationType) {
      case 'float':
        toyRef.current.position.y = position.y + Math.sin(time * 0.8 + position.x) * 0.3
        toyRef.current.rotation.y += 0.005
        break
      case 'rotate':
        toyRef.current.rotation.x = Math.sin(time * 0.5) * 0.2
        toyRef.current.rotation.z = Math.cos(time * 0.3) * 0.1
        break
      case 'bounce':
        toyRef.current.position.y = position.y + Math.abs(Math.sin(time * 2 + position.x * 3)) * 0.5
        toyRef.current.rotation.y = time * 0.5
        break
    }

    // Text always faces camera
    textRef.current.lookAt(state.camera.position)
  })

  const handleClick = () => {
    if (toyRef.current) {
      // Bounce animation on click
      const originalY = toyRef.current.position.y
      toyRef.current.position.y = originalY + 0.5
      setTimeout(() => {
        if (toyRef.current) {
          toyRef.current.position.y = originalY
        }
      }, 200)
    }
    onClick?.()
  }

  const renderGeometry = () => {
    switch (geometry) {
      case 'box':
        return <Box args={[1.2, 1.2, 1.2]} />
      case 'sphere':
        return <Sphere args={[0.8, 16, 16]} />
      case 'cylinder':
        return <Cylinder args={[0.6, 0.6, 1.2, 8]} />
      default:
        return <Box args={[1, 1, 1]} />
    }
  }

  return (
    <group position={position}>
      <mesh
        ref={toyRef}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        {renderGeometry()}
        <meshStandardMaterial
          color={color}
          metalness={0.1}
          roughness={0.3}
          emissive={color}
          emissiveIntensity={0.1}
        />
      </mesh>
      
      {/* Floating icon representation */}
      <mesh
        ref={textRef}
        position={[0, 1.5, 0]}
      >
        <Sphere args={[0.4, 8, 8]}>
          <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.2} />
        </Sphere>
      </mesh>
      
      {/* Title representation */}
      <mesh position={[0, -1.5, 0]}>
        <Box args={[title.length * 0.2, 0.3, 0.05]}>
          <meshStandardMaterial color="white" />
        </Box>
      </mesh>
    </group>
  )
}

// Decorative particles/sparkles
const FloatingSparkle = ({ position }: { position: Vector3 }) => {
  const sparkleRef = useRef<Mesh>(null)

  useFrame((state) => {
    if (sparkleRef.current) {
      const time = state.clock.elapsedTime
      sparkleRef.current.position.y = position.y + Math.sin(time * 1.5 + position.x * 5) * 2
      sparkleRef.current.rotation.x = time * 2
      sparkleRef.current.rotation.y = time * 1.5
      sparkleRef.current.rotation.z = time * 2.5
      
      // Fade in and out
      const opacity = (Math.sin(time * 0.8 + position.x * 3) + 1) * 0.5
      if (sparkleRef.current.material) {
        (sparkleRef.current.material as any).opacity = opacity
      }
    }
  })

  return (
    <mesh ref={sparkleRef} position={position}>
      <Sphere args={[0.05, 8, 8]} />
      <meshStandardMaterial
        color="#FFD700"
        emissive="#FFD700"
        emissiveIntensity={0.5}
        transparent
        opacity={0.8}
      />
    </mesh>
  )
}

interface ToyboxScene3DProps {
  onNavigate: (route: string) => void
}

export const ToyboxScene3D: React.FC<ToyboxScene3DProps> = ({ onNavigate }) => {
  // Create toys
  const toys = useMemo(() => [
    {
      position: new Vector3(-3, 0, 0),
      geometry: 'box' as const,
      color: '#FF6B6B',
      title: 'Bogstaver',
      route: '/alphabet',
      animationType: 'rotate' as const
    },
    {
      position: new Vector3(3, 0, 0),
      geometry: 'sphere' as const,
      color: '#4ECDC4',
      title: 'Tal',
      route: '/math',
      animationType: 'bounce' as const
    },
    {
      position: new Vector3(0, 0, -3),
      geometry: 'cylinder' as const,
      color: '#FFD700',
      title: 'Farver',
      route: '/farver',
      animationType: 'float' as const
    },
    {
      position: new Vector3(0, 0, 3),
      geometry: 'box' as const,
      color: '#96CEB4',
      title: 'Puslespil',
      route: '/memory',
      animationType: 'rotate' as const
    }
  ], [onNavigate])

  // Create sparkles
  const sparkles = useMemo(() => {
    const sparkleArray = []
    for (let i = 0; i < 20; i++) {
      sparkleArray.push({
        position: new Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 20
        )
      })
    }
    return sparkleArray
  }, [])

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <pointLight position={[5, 5, 5]} intensity={1} color="#FFD700" />
      <pointLight position={[-5, -5, -5]} intensity={0.5} color="#FF6B6B" />
      <pointLight position={[0, 10, 0]} intensity={0.8} color="#4ECDC4" />

      {/* Camera controls */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={8}
        maxDistance={20}
        autoRotate={true}
        autoRotateSpeed={1}
        maxPolarAngle={Math.PI * 0.8}
        minPolarAngle={Math.PI * 0.2}
      />

      {/* Welcome text representation */}
      <mesh position={[0, 4, 0]}>
        <Box args={[6, 1, 0.2]}>
          <meshStandardMaterial
            color="#FFD700"
            emissive="#FFD700"
            emissiveIntensity={0.3}
          />
        </Box>
      </mesh>

      {/* Render toys */}
      {toys.map((toy, index) => (
        <AnimatedToy
          key={index}
          position={toy.position}
          geometry={toy.geometry}
          color={toy.color}
          title={toy.title}
          onClick={() => onNavigate(toy.route)}
          animationType={toy.animationType}
        />
      ))}

      {/* Render sparkles */}
      {sparkles.map((sparkle, index) => (
        <FloatingSparkle
          key={index}
          position={sparkle.position}
        />
      ))}

      {/* Floor */}
      <mesh position={[0, -3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <Box args={[20, 20, 0.1]} />
        <meshStandardMaterial
          color="#E8E8E8"
          metalness={0.1}
          roughness={0.8}
          transparent
          opacity={0.3}
        />
      </mesh>
    </>
  )
}

export default ToyboxScene3D