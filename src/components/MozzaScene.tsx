import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/** Single 3D mozzarella ball with realistic material */
function MozzarellaBall({
  radius = 0.35,
}: {
  radius?: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.3
    }
  })

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <sphereGeometry args={[radius, 48, 48]} />
      <meshStandardMaterial
        color="#f8f4e8"
        roughness={0.65}
        metalness={0.05}
        flatShading={false}
      />
    </mesh>
  )
}

/** Orbiting ball that circles the center on a tilted plane */
function OrbitingBall({
  orbitRadius,
  speed,
  tiltX,
  tiltZ,
  offset = 0,
}: {
  orbitRadius: number
  speed: number
  tiltX: number
  tiltZ: number
  offset?: number
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (groupRef.current) {
      const t = state.clock.elapsedTime * speed + offset
      // Base circular orbit in XZ plane
      const x = Math.cos(t) * orbitRadius
      const z = Math.sin(t) * orbitRadius
      // Tilt the orbit plane
      groupRef.current.position.x = x * Math.cos(tiltZ) - z * Math.sin(tiltZ)
      groupRef.current.position.z = x * Math.sin(tiltZ) + z * Math.cos(tiltZ)
      groupRef.current.position.y = Math.sin(t) * orbitRadius * Math.sin(tiltX)
    }
  })

  return (
    <group ref={groupRef}>
      <MozzarellaBall />
    </group>
  )
}

export default function MozzaScene() {
  return (
    <Canvas
      camera={{ position: [0, 1, 5], fov: 50 }}
      style={{ width: 220, height: 220 }}
      shadows
      dpr={[1, 2]}
    >
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[3, 4, 3]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <pointLight position={[-3, -2, 2]} intensity={0.3} />

      {/* Two orbiting mozzarella balls on different orbital planes */}
      <OrbitingBall orbitRadius={1.8} speed={1.0} tiltX={Math.PI / 3} tiltZ={0} offset={0} />
      <OrbitingBall orbitRadius={1.8} speed={1.0} tiltX={Math.PI / 3} tiltZ={Math.PI / 2} offset={Math.PI} />
    </Canvas>
  )
}