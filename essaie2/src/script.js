// Particle Cloud in 3D space — cube/sphere volumetric distribution
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createNoise2D } from 'simplex-noise'

const canvas = document.querySelector('canvas.webgl')
const noise2D = createNoise2D()
const texture = new THREE.TextureLoader().load('/textures/particles/3.png')

// Scene setup
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 1000)
camera.position.set(0, -120, 260)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// OrbitControls for mouse rotation and zoom
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.autoRotate = false
controls.autoRotateSpeed = 2


// Parameters
const params = {
  particleCount: 8000,
  volumeType: 'sphere', // 'cube' or 'sphere'
  volumeSize: 200,
  noiseScale: 0.005,
  speed: 0.1,
  pointSize: 2,
  time: 0
}

// Curl Noise function (3D variant)
function curlNoise3D(x, y, z, eps = 0.001) {
  const n1 = noise2D(x, y + eps)
  const n2 = noise2D(x, y - eps)
  const a = (n1 - n2) / (2 * eps)

  const n3 = noise2D(x + eps, y)
  const n4 = noise2D(x - eps, y)
  const b = (n3 - n4) / (2 * eps)

  const n5 = noise2D(z, x + eps)
  const n6 = noise2D(z, x - eps)
  const c = (n5 - n6) / (2 * eps)

  return new THREE.Vector3(a, b, c)
}

// Particle cloud
let particles = []
let geometry, material, points

function initParticles() {
  // Remove old points
  if (points) scene.remove(points)

  particles = []
  const positions = new Float32Array(params.particleCount * 3)

  for (let i = 0; i < params.particleCount; i++) {
    let x, y, z

    if (params.volumeType === 'sphere') {
      // Random point in sphere
      const radius = (Math.random() ** (1/3)) * params.volumeSize * 0.5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      x = radius * Math.sin(phi) * Math.cos(theta)
      y = radius * Math.sin(phi) * Math.sin(theta)
      z = radius * Math.cos(phi)
    } else {
      // Random point in cube
      const half = params.volumeSize * 0.5
      x = (Math.random() - 0.5) * params.volumeSize
      y = (Math.random() - 0.5) * params.volumeSize
      z = (Math.random() - 0.5) * params.volumeSize
    }

    particles.push({ pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3() })
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
  }

  geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: params.pointSize,
    map: texture,
    transparent: true,
    opacity: 0.8
  })

  points = new THREE.Points(geometry, material)
  scene.add(points)
}

function updateParticles() {
  const positions = geometry.attributes.position.array
  const maxRadius = params.volumeSize * 0.5

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    const flow = curlNoise3D(
      p.pos.x * params.noiseScale,
      p.pos.y * params.noiseScale,
      p.pos.z * params.noiseScale + params.time
    )

    p.vel.copy(flow).multiplyScalar(params.speed)
    p.pos.add(p.vel)

    // Boundary wrapping based on volume type
    if (params.volumeType === 'sphere') {
      // Sphere boundary: reset particle if outside sphere radius
      const distFromCenter = p.pos.length()
      if (distFromCenter > maxRadius) {
        // Reset to random point in sphere
        const radius = (Math.random() ** (1/3)) * maxRadius
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        p.pos.set(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi)
        )
      }
    } else {
      // Cube boundary
      const half = params.volumeSize * 0.5
      if (p.pos.x > half) p.pos.x -= params.volumeSize
      if (p.pos.x < -half) p.pos.x += params.volumeSize
      if (p.pos.y > half) p.pos.y -= params.volumeSize
      if (p.pos.y < -half) p.pos.y += params.volumeSize
      if (p.pos.z > half) p.pos.z -= params.volumeSize
      if (p.pos.z < -half) p.pos.z += params.volumeSize
    }

    positions[i * 3] = p.pos.x
    positions[i * 3 + 1] = p.pos.y
    positions[i * 3 + 2] = p.pos.z
  }

  geometry.attributes.position.needsUpdate = true
  params.time += 0.01
}

function animate() {
  controls.update()
  updateParticles()
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

// Handle window resize
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()
  renderer.setSize(sizes.width, sizes.height)
  controls.handleResize?.()
})

// GUI
import('lil-gui').then(mod => {
  try {
    const GUI = mod.default
    const gui = new GUI({ width: 300 })
    gui.add(params, 'particleCount', 500, 10000, 100).onChange(() => initParticles())
    gui.add(params, 'volumeType', ['cube', 'sphere']).onChange(() => initParticles())
    gui.add(params, 'volumeSize', 50, 500, 10).onChange(() => initParticles())
    gui.add(params, 'noiseScale', 0.001, 0.02, 0.001).name('Noise scale')
    gui.add(params, 'speed', 0.01, 0.5, 0.01)
    gui.add(params, 'pointSize', 0.5, 10, 0.5).onChange(v => material.size = v)
    gui.close()
  } catch (e) {
    console.warn('GUI failed', e)
  }
}).catch(() => {})

initParticles()
animate()
