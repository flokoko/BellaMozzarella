import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/** Procedural bump texture for mozzarella surface irregularity */
function useMozzarellaTexture() {
  return useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // Base: creamy off-white
    ctx.fillStyle = '#f5f0e0'
    ctx.fillRect(0, 0, size, size)

    // Add irregular dents and bumps (mozzarella surface texture)
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const r = 4 + Math.random() * 12
      const brightness = Math.random() > 0.5 ? 15 : -20
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
      const val = brightness > 0 ? `rgba(255,250,235,0.4)` : `rgba(200,190,165,0.35)`
      grad.addColorStop(0, val)
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Small specks (like brine droplets or surface grain)
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const r = 1 + Math.random() * 2.5
      ctx.fillStyle = `rgba(180,170,145,${0.15 + Math.random() * 0.2})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    return texture
  }, [])
}

/** Single 3D mozzarella ball with realistic material */
function MozzarellaBall({
  radius = 0.35,
}: {
  radius?: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useMozzarellaTexture()

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.8
    }
  })

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshPhysicalMaterial
        color="#f5f0e0"
        roughness={0.75}
        metalness={0.0}
        clearcoat={0.15}
        clearcoatRoughness={0.8}
        sheen={0.5}
        sheenColor="#fff8e8"
        sheenRoughness={0.5}
        map={texture}
        bumpMap={texture}
        bumpScale={0.03}
        transparent
        opacity={0.92}
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
      {/* Lighting — warm tones for fresh mozzarella look */}
      <ambientLight intensity={0.5} color="#fff5e6" />
      <directionalLight
        position={[3, 4, 3]}
        intensity={1.5}
        color="#fff8ee"
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <pointLight position={[-3, -2, 2]} intensity={0.4} color="#ffe8cc" />

      {/* Two orbiting mozzarella balls on different orbital planes */}
      <OrbitingBall orbitRadius={1.8} speed={2.5} tiltX={Math.PI / 3} tiltZ={0} offset={0} />
      <OrbitingBall orbitRadius={1.8} speed={2.5} tiltX={Math.PI / 3} tiltZ={Math.PI / 2} offset={Math.PI} />
    </Canvas>
  )
}