import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/** Procedural texture for mozzarella: smooth, very subtle cheese grain */
function useMozzarellaTexture() {
  return useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // Base: pure white
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)

    // No warm undertones — keep it pure white
    // Very faint cool-white variation only (subtle surface micro-texture)
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const r = 2 + Math.random() * 5
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, 'rgba(253,253,253,0.06)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
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

/** Deformed sphere geometry — irregular, lumpy like real mozzarella */
function useMozzarellaGeometry(radius: number) {
  return useMemo(() => {
    const geo = new THREE.SphereGeometry(radius, 64, 64)
    const pos = geo.attributes.position as THREE.BufferAttribute
    const v = new THREE.Vector3()

    // Pseudo-random with seed for consistent deformation
    let seed = 42
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      // Multiple frequency noise for organic lumpy shape
      const n1 = Math.sin(v.x * 8 + v.y * 6) * Math.cos(v.z * 7) * 0.025
      const n2 = Math.sin(v.y * 12 + v.z * 10) * Math.cos(v.x * 9) * 0.015
      const n3 = (rand() - 0.5) * 0.02
      const deform = 1 + n1 + n2 + n3
      v.multiplyScalar(deform)
      pos.setXYZ(i, v.x, v.y, v.z)
    }

    geo.computeVertexNormals()
    return geo
  }, [radius])
}

/** Single 3D mozzarella ball with realistic material */
function MozzarellaBall({
  radius = 0.35,
}: {
  radius?: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const texture = useMozzarellaTexture()
  const geometry = useMozzarellaGeometry(radius)

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.8
    }
  })

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshPhysicalMaterial
        color="#ffffff"
        roughness={0.35}
        metalness={0.0}
        clearcoat={0.5}
        clearcoatRoughness={0.3}
        sheen={1.0}
        sheenColor="#ffffff"
        sheenRoughness={0.2}
        map={texture}
        transparent
        opacity={1.0}
        envMapIntensity={0.8}
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
      {/* Lighting — neutral/cool white to keep mozzarella pure white */}
      <ambientLight intensity={0.7} color="#ffffff" />
      <directionalLight
        position={[3, 4, 3]}
        intensity={1.5}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <pointLight position={[-3, -2, 2]} intensity={0.3} color="#ffffff" />

      {/* Two orbiting mozzarella balls on different orbital planes */}
      <OrbitingBall orbitRadius={1.8} speed={2.5} tiltX={Math.PI / 3} tiltZ={0} offset={0} />
      <OrbitingBall orbitRadius={1.8} speed={2.5} tiltX={Math.PI / 3} tiltZ={Math.PI / 2} offset={Math.PI} />
    </Canvas>
  )
}