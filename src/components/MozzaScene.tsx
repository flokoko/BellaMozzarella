import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/** Procedural texture for mozzarella: fibrous cheese strands + smooth white surface */
function useMozzarellaTexture() {
  return useMemo(() => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // Base: pure white (fresh mozzarella)
    ctx.fillStyle = '#fefefb'
    ctx.fillRect(0, 0, size, size)

    // Subtle warm undertone patches (cheese body variation)
    for (let i = 0; i < 25; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const r = 30 + Math.random() * 60
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, 'rgba(248,243,228,0.3)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Fibrous cheese strands — the signature mozzarella pull texture
    ctx.lineCap = 'round'
    for (let i = 0; i < 80; i++) {
      const x1 = Math.random() * size
      const y1 = Math.random() * size
      const angle = Math.random() * Math.PI * 2
      const len = 20 + Math.random() * 60
      const x2 = x1 + Math.cos(angle) * len
      const y2 = y1 + Math.sin(angle) * len
      const opacity = 0.08 + Math.random() * 0.12
      ctx.strokeStyle = `rgba(235,228,205,${opacity})`
      ctx.lineWidth = 1 + Math.random() * 2.5
      ctx.beginPath()
      // Slight curve for organic fiber look
      const cx = (x1 + x2) / 2 + (Math.random() - 0.5) * 15
      const cy = (y1 + y2) / 2 + (Math.random() - 0.5) * 15
      ctx.moveTo(x1, y1)
      ctx.quadraticCurveTo(cx, cy, x2, y2)
      ctx.stroke()
    }

    // Fine grain texture (tiny cheese particles)
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const r = 0.5 + Math.random() * 1.5
      const v = Math.random()
      ctx.fillStyle = v > 0.6
        ? `rgba(240,235,220,${0.1 + Math.random() * 0.15})`
        : `rgba(252,250,245,${0.15 + Math.random() * 0.2})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Soft glossy highlights (wet mozzarella surface from brine)
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * size
      const y = Math.random() * size
      const r = 15 + Math.random() * 30
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, 'rgba(255,255,255,0.5)')
      grad.addColorStop(0.5, 'rgba(255,255,255,0.15)')
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
        color="#fdfdf9"
        roughness={0.55}
        metalness={0.0}
        clearcoat={0.3}
        clearcoatRoughness={0.6}
        sheen={0.8}
        sheenColor="#ffffff"
        sheenRoughness={0.3}
        map={texture}
        bumpMap={texture}
        bumpScale={0.015}
        transparent
        opacity={0.95}
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