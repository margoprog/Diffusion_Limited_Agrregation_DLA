// 3D Particle Cloud with Curl Noise 3D
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createNoise3D } from 'simplex-noise'

const canvas = document.querySelector('canvas.webgl')
const noise3D = createNoise3D()
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

// Parameters
const params = {
  particleCount: 8000,
  volumeType: 'sphere',
  volumeSize: 200,
  noiseScale: 0.015,
  speed: 0.1,
  pointSize: 2,
  time: 0,
  warpStrength: 0.2,
  warpScale: 0.005,
  flowCoherence: 1.0
}

// Curl Noise 3D: compute curl of noise field (∇ × F)
function curlNoise3D(x, y, z, eps = 0.001) {
  // ∇ × F = (∂Fz/∂y - ∂Fy/∂z, ∂Fx/∂z - ∂Fz/∂x, ∂Fy/∂x - ∂Fx/∂y)
  
  const n_xy_eps = noise3D(x, y + eps, z)
  const n_xy_neg = noise3D(x, y - eps, z)
  const n_xz_eps = noise3D(x, y, z + eps)
  const n_xz_neg = noise3D(x, y, z - eps)
  const n_yz_eps = noise3D(x + eps, y, z)
  const n_yz_neg = noise3D(x - eps, y, z)
  
  const dFz_dy = (n_xy_eps - n_xy_neg) / (2 * eps)
  const dFy_dz = (n_xz_eps - n_xz_neg) / (2 * eps)
  const dFx_dz = (n_xz_eps - n_xz_neg) / (2 * eps)
  const dFz_dx = (n_yz_eps - n_yz_neg) / (2 * eps)
  const dFy_dx = (n_yz_eps - n_yz_neg) / (2 * eps)
  const dFx_dy = (n_xy_eps - n_xy_neg) / (2 * eps)
  
  const curl_x = dFz_dy - dFy_dz
  const curl_y = dFx_dz - dFz_dx
  const curl_z = dFy_dx - dFx_dy
  
  return new THREE.Vector3(curl_x, curl_y, curl_z).normalize()
}

// Domain Warping: distort coordinates using noise for more complex patterns
function domainWarp(x, y, z, time) {
  // First layer of warping - coarse scale
  const warp1_x = noise3D(x * 0.5, y * 0.5, z * 0.5 + time * 0.3) * params.warpStrength
  const warp1_y = noise3D(x * 0.5 + 10, y * 0.5 + 10, z * 0.5 + time * 0.3) * params.warpStrength
  const warp1_z = noise3D(x * 0.5 + 20, y * 0.5 + 20, z * 0.5 + time * 0.3) * params.warpStrength
  
  // Second layer of warping - finer scale using warped coordinates
  const wx = x + warp1_x * params.warpScale
  const wy = y + warp1_y * params.warpScale
  const wz = z + warp1_z * params.warpScale
  
  const warp2_x = noise3D(wx * 0.8, wy * 0.8, wz * 0.8 + time * 0.5) * params.warpStrength * 0.5
  const warp2_y = noise3D(wx * 0.8 + 5, wy * 0.8 + 5, wz * 0.8 + time * 0.5) * params.warpStrength * 0.5
  const warp2_z = noise3D(wx * 0.8 + 15, wy * 0.8 + 15, wz * 0.8 + time * 0.5) * params.warpStrength * 0.5
  
  return new THREE.Vector3(
    wx + warp2_x * params.warpScale,
    wy + warp2_y * params.warpScale,
    wz + warp2_z * params.warpScale
  )
}

let particles = []
let geometry, material, points

function initParticles() {
  if (points) scene.remove(points)
  
  particles = []
  const positions = new Float32Array(params.particleCount * 3)
  
  for (let i = 0; i < params.particleCount; i++) {
    let x, y, z
    
    if (params.volumeType === 'sphere') {
      const radius = (Math.random() ** (1/3)) * params.volumeSize * 0.5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      x = radius * Math.sin(phi) * Math.cos(theta)
      y = radius * Math.sin(phi) * Math.sin(theta)
      z = radius * Math.cos(phi)
    } else {
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
    opacity: 0.8,
    alphaTest: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  
  points = new THREE.Points(geometry, material)
  scene.add(points)
}

function updateParticles() {
  const positions = geometry.attributes.position.array
  const maxRadius = params.volumeSize * 0.5
  
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    
    // Step 0: Apply domain warping to distort the sampling coordinates
    const warpedPos = domainWarp(
      p.pos.x * params.noiseScale,
      p.pos.y * params.noiseScale,
      p.pos.z * params.noiseScale,
      params.time * 0.5
    )
    
    // Step 1: Query curl noise field at warped position
    const curlVector = curlNoise3D(warpedPos.x, warpedPos.y, warpedPos.z)
    
    // Step 2: Get directional vector from curl noise
    p.vel.copy(curlVector).multiplyScalar(params.speed)
    
    // Step 3: Move particle in that direction
    p.pos.add(p.vel)
    
    // Step 4: Apply boundary constraints (continuous field - no randomness)
    if (params.volumeType === 'sphere') {
      const distFromCenter = p.pos.length()
      if (distFromCenter > maxRadius) {
        // Gradient field: push particle back toward center smoothly
        const normal = p.pos.clone().normalize()
        const excess = distFromCenter - maxRadius
        p.pos.sub(normal.multiplyScalar(excess * 0.8))
      }
    } else {
      // Cube: wrapping continuous
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

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()
  renderer.setSize(sizes.width, sizes.height)
})

import('lil-gui').then(mod => {
  try {
    const GUI = mod.default
    const gui = new GUI({ width: 300 })
    gui.add(params, 'particleCount', 500, 15000, 100).onChange(() => initParticles())
    gui.add(params, 'volumeType', ['cube', 'sphere']).onChange(() => initParticles())
    gui.add(params, 'volumeSize', 50, 500, 10).onChange(() => initParticles())
    gui.add(params, 'noiseScale', 0.001, 0.02, 0.001)
    gui.add(params, 'speed', 0.01, 0.5, 0.01)
    gui.add(params, 'pointSize', 0.5, 10, 0.5).onChange(v => material.size = v)
    gui.add(params, 'warpStrength', 0, 1, 0.01).name('Warp strength')
    gui.add(params, 'warpScale', 0.001, 0.05, 0.001).name('Warp scale')
    gui.close()
  } catch (e) { console.warn('GUI failed', e) }
}).catch(() => {})

initParticles()
animate()