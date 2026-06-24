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
  noiseScale: 0.01,
  speed: 0.3,
  pointSize: 2,
  time: 0,
  warpStrength: 0.08,
  warpScale: 0.005,
  flowCoherence: 2.5,
  velocityResponse: 0.08,
  drag: 0.96,
  circulationStrength: 0.35,
  orbitCenterCount: 9,
  orbitRadius: 70,
  orbitStrength: 0.8,
  orbitPull: 0.08,
  inwardStrength: 0.06,
  timeSpeed: 0.2
}

// Curl Noise 3D: compute curl of noise field (∇ × F)
function curlNoise3D(x, y, z, eps = 0.001) {
  // ∇ × F = (∂Fz/∂y - ∂Fy/∂z, ∂Fx/∂z - ∂Fz/∂x, ∂Fy/∂x - ∂Fx/∂y)
  const e = eps * params.flowCoherence
  
  const n_xy_eps = noise3D(x, y + e, z)
  const n_xy_neg = noise3D(x, y - e, z)
  const n_xz_eps = noise3D(x, y, z + e)
  const n_xz_neg = noise3D(x, y, z - e)
  const n_yz_eps = noise3D(x + e, y, z)
  const n_yz_neg = noise3D(x - e, y, z)
  
  const dFz_dy = (n_xy_eps - n_xy_neg) / (2 * e)
  const dFy_dz = (n_xz_eps - n_xz_neg) / (2 * e)
  const dFx_dz = (n_xz_eps - n_xz_neg) / (2 * e)
  const dFz_dx = (n_yz_eps - n_yz_neg) / (2 * e)
  const dFy_dx = (n_yz_eps - n_yz_neg) / (2 * e)
  const dFx_dy = (n_xy_eps - n_xy_neg) / (2 * e)
  
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
let orbitCenters = []

function buildOrbitCenters() {
  orbitCenters = []
  const shell = params.volumeSize * 0.38
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < params.orbitCenterCount; i++) {
    const t = (i + 0.5) / params.orbitCenterCount
    const y = 1 - 2 * t
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = i * goldenAngle

    const pos = new THREE.Vector3(
      Math.cos(theta) * r * shell,
      y * shell,
      Math.sin(theta) * r * shell
    )

    const axis = new THREE.Vector3(
      noise3D(pos.x * 0.02 + 7.1, pos.y * 0.02, pos.z * 0.02),
      noise3D(pos.x * 0.02, pos.y * 0.02 + 13.7, pos.z * 0.02),
      noise3D(pos.x * 0.02, pos.y * 0.02, pos.z * 0.02 + 19.3)
    )
    if (axis.lengthSq() < 1e-6) axis.set(0, 1, 0)
    axis.normalize()

    orbitCenters.push({ pos, axis })
  }
}

function initParticles() {
  if (points) scene.remove(points)
  buildOrbitCenters()
  
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
  const center = new THREE.Vector3(0, 0, 0)
  const tmpDesired = new THREE.Vector3()
  const tmpCirculation = new THREE.Vector3()
  const tmpLocalOrbit = new THREE.Vector3()
  const tmpToCenter = new THREE.Vector3()
  const tmpTangent = new THREE.Vector3()
  const tmpRadial = new THREE.Vector3()
  const t = params.time * params.timeSpeed
  
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    
    // Step 0: Apply domain warping to distort the sampling coordinates
    const warpedPos = domainWarp(
      p.pos.x * params.noiseScale,
      p.pos.y * params.noiseScale,
      p.pos.z * params.noiseScale,
      t
    )
    
    // Step 1: Query curl noise field at warped position
    const curlVector = curlNoise3D(warpedPos.x, warpedPos.y, warpedPos.z)

    // Large-scale circulation around Y axis to make visible currents
    const radius = p.pos.length()
    const radialFactor = Math.max(0, 1 - radius / maxRadius)
    tmpCirculation.set(-p.pos.z, 0, p.pos.x)
    if (tmpCirculation.lengthSq() > 0) tmpCirculation.normalize()
    tmpCirculation.multiplyScalar(params.circulationStrength * radialFactor)

    // Gentle inward drift to keep stable circulation zones
    tmpRadial.copy(center).sub(p.pos)
    if (tmpRadial.lengthSq() > 0) tmpRadial.normalize()
    tmpRadial.multiplyScalar(params.inwardStrength)

    // Local orbital tendency around invisible centers
    tmpLocalOrbit.set(0, 0, 0)
    for (let ci = 0; ci < orbitCenters.length; ci++) {
      const c = orbitCenters[ci]
      tmpToCenter.copy(p.pos).sub(c.pos)
      const d = tmpToCenter.length()
      if (d < 1e-5 || d > params.orbitRadius) continue

      const falloff = 1 - d / params.orbitRadius
      tmpTangent.crossVectors(c.axis, tmpToCenter)
      if (tmpTangent.lengthSq() > 1e-10) {
        tmpTangent.normalize().multiplyScalar(params.orbitStrength * falloff * falloff)
        tmpLocalOrbit.add(tmpTangent)
      }

      // slight inward pull to keep the particle captured by local vortex zones
      tmpToCenter.multiplyScalar(1 / d)
      tmpLocalOrbit.addScaledVector(tmpToCenter, -params.orbitPull * falloff)
    }
    
    // Step 2: Get directional vector from curl noise
    tmpDesired.copy(curlVector).add(tmpCirculation).add(tmpLocalOrbit).add(tmpRadial)
    p.vel.lerp(tmpDesired, params.velocityResponse)
    p.vel.multiplyScalar(params.drag)
    
    // Step 3: Move particle in that direction
    p.pos.addScaledVector(p.vel, params.speed)
    
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
    gui.add(params, 'flowCoherence', 0.8, 5, 0.1).name('Flow coherence')
    gui.add(params, 'velocityResponse', 0.01, 0.3, 0.01).name('Response')
    gui.add(params, 'drag', 0.85, 0.999, 0.001).name('Drag')
    gui.add(params, 'circulationStrength', 0, 1.5, 0.01).name('Circulation')
    gui.add(params, 'orbitCenterCount', 1, 16, 1).name('Orbit centers').onChange(() => buildOrbitCenters())
    gui.add(params, 'orbitRadius', 20, 180, 1).name('Orbit radius')
    gui.add(params, 'orbitStrength', 0, 2, 0.01).name('Orbit strength')
    gui.add(params, 'orbitPull', 0, 0.4, 0.01).name('Orbit pull')
    gui.add(params, 'inwardStrength', 0, 0.3, 0.01).name('Inward')
    gui.add(params, 'timeSpeed', 0.02, 1.5, 0.01).name('Time speed')
    gui.add(params, 'pointSize', 0.5, 10, 0.5).onChange(v => material.size = v)
    gui.add(params, 'warpStrength', 0, 1, 0.01).name('Warp strength')
    gui.add(params, 'warpScale', 0.001, 0.05, 0.001).name('Warp scale')
    gui.close()
  } catch (e) { console.warn('GUI failed', e) }
}).catch(() => {})

initParticles()
animate()