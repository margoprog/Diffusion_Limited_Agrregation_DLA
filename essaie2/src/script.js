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
  speed: 0.2,
  pointSize: 2,
  time: 0,
  warpStrength: 0.08,
  warpScale: 0.005,
  mediumCurlScale: 0.008,
  mediumCurlStrength: 0.55,
  microCurlScale: 0.06,
  microCurlStrength: 0.28,
  flowCoherence: 2.5,
  velocityResponse: 0.08,
  drag: 0.96,
  circulationStrength: 0.35,
  vortexCount: 140,
  vortexRadius: 36,
  vortexStrength: 0.7,
  vortexAxisJitter: 0.25,
  vortexSizeVariation: 0.7,
  vortexStrengthVariation: 0.8,
  densityFieldScale: 0.015,
  clumpStrength: 0.22,
  airyStrength: 0.14,
  shapeIrregularity: 0.18,
  shapeNoiseScale: 3.2,
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

// Scalar density field used to create denser and airier regions
function densityField(x, y, z, t) {
  const s = params.densityFieldScale
  const n1 = noise3D(x * s + t * 0.05, y * s, z * s)
  const n2 = noise3D(x * s * 2 + 17.3, y * s * 2 - 9.1, z * s * 2 + t * 0.09) * 0.5
  const n3 = noise3D(x * s * 4 - 23.7, y * s * 4 + 5.4, z * s * 4 - t * 0.12) * 0.25
  return (n1 + n2 + n3) / 1.75
}

// Organic boundary multiplier in direction space (breaks perfect sphere)
function organicRadiusMultiplier(dir, t) {
  const s = params.shapeNoiseScale
  const n1 = noise3D(dir.x * s + t * 0.11, dir.y * s, dir.z * s)
  const n2 = noise3D(dir.x * s * 2 + 13.7, dir.y * s * 2 - 4.2, dir.z * s * 2 + t * 0.07) * 0.5
  const n = (n1 + n2) / 1.5
  return 1 + n * params.shapeIrregularity
}

let particles = []
let geometry, material, points
let vortices = []

function hash01(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123
  return x - Math.floor(x)
}

function buildVortices() {
  vortices = []

  const maxR = params.volumeSize * 0.46
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < params.vortexCount; i++) {
    const t = (i + 0.5) / params.vortexCount
    const y = 1 - 2 * t
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = i * goldenAngle

    // volumetric placement: not on a shell, distributed in the whole sphere
    const rr = Math.cbrt(hash01(i + 1.73)) * maxR

    const center = new THREE.Vector3(
      Math.cos(theta) * r * rr,
      y * rr,
      Math.sin(theta) * r * rr
    )

    // deterministic axis per vortex
    const axis = new THREE.Vector3(
      noise3D(center.x * 0.02 + 11.3, center.y * 0.02 + 3.7, center.z * 0.02),
      noise3D(center.x * 0.02, center.y * 0.02 + 19.1, center.z * 0.02 + 5.2),
      noise3D(center.x * 0.02 + 7.9, center.y * 0.02, center.z * 0.02 + 23.4)
    )
    if (axis.lengthSq() < 1e-8) axis.set(0, 1, 0)
    axis.normalize()

    const radiusFactor = 1 - params.vortexSizeVariation * 0.5 + hash01(i * 3.11 + 9.3) * params.vortexSizeVariation
    const strengthFactor = 1 - params.vortexStrengthVariation * 0.5 + hash01(i * 5.93 + 4.7) * params.vortexStrengthVariation

    vortices.push({ center, axis, seed: i * 17.123, radiusFactor, strengthFactor })
  }
}

function initParticles() {
  if (points) scene.remove(points)

  buildVortices()
  
  particles = []
  const positions = new Float32Array(params.particleCount * 3)
  const baseRadius = params.volumeSize * 0.5
  const dir = new THREE.Vector3()
  const t = params.time * params.timeSpeed
  
  for (let i = 0; i < params.particleCount; i++) {
    let x, y, z
    
    if (params.volumeType === 'sphere') {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      dir.set(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi)
      )
      const localRadius = baseRadius * organicRadiusMultiplier(dir, t)
      const radius = (Math.random() ** (1 / 3)) * localRadius
      x = radius * dir.x
      y = radius * dir.y
      z = radius * dir.z
    } else {
      const half = params.volumeSize * 0.5
      x = (Math.random() - 0.5) * params.volumeSize
      y = (Math.random() - 0.5) * params.volumeSize
      z = (Math.random() - 0.5) * params.volumeSize
    }
    
    const pPos = new THREE.Vector3(x, y, z)
    const seedBase = domainWarp(pPos.x * params.noiseScale, pPos.y * params.noiseScale, pPos.z * params.noiseScale, t)
    const seedMedium = domainWarp(pPos.x * params.mediumCurlScale, pPos.y * params.mediumCurlScale, pPos.z * params.mediumCurlScale, t * 0.7)
    const seedMicro = domainWarp(
      pPos.x * params.microCurlScale + 31.7,
      pPos.y * params.microCurlScale - 19.4,
      pPos.z * params.microCurlScale + 7.9,
      t * 1.6
    )
    const pVel = curlNoise3D(seedBase.x, seedBase.y, seedBase.z)
      .add(curlNoise3D(seedMedium.x, seedMedium.y, seedMedium.z).multiplyScalar(params.mediumCurlStrength))
      .add(curlNoise3D(seedMicro.x, seedMicro.y, seedMicro.z).multiplyScalar(params.microCurlStrength))
      .multiplyScalar(0.25)

    particles.push({ pos: pPos, vel: pVel })
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
  const tmpVortex = new THREE.Vector3()
  const tmpToVortex = new THREE.Vector3()
  const tmpLocalAxis = new THREE.Vector3()
  const tmpTangential = new THREE.Vector3()
  const tmpRadial = new THREE.Vector3()
  const tmpDensityGrad = new THREE.Vector3()
  const tmpDir = new THREE.Vector3()
  const tmpMediumCurl = new THREE.Vector3()
  const tmpMicroCurl = new THREE.Vector3()
  const t = params.time * params.timeSpeed
  const ge = Math.max(0.5, params.volumeSize * 0.01)
  
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

    // Hierarchical turbulence: medium currents + tiny local vortices
    const mediumPos = domainWarp(
      p.pos.x * params.mediumCurlScale,
      p.pos.y * params.mediumCurlScale,
      p.pos.z * params.mediumCurlScale,
      t * 0.7
    )
    tmpMediumCurl.copy(curlNoise3D(mediumPos.x, mediumPos.y, mediumPos.z)).multiplyScalar(params.mediumCurlStrength)

    const microPos = domainWarp(
      p.pos.x * params.microCurlScale + 31.7,
      p.pos.y * params.microCurlScale - 19.4,
      p.pos.z * params.microCurlScale + 7.9,
      t * 1.6
    )
    tmpMicroCurl.copy(curlNoise3D(microPos.x, microPos.y, microPos.z)).multiplyScalar(params.microCurlStrength)

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

    // Density shaping: particles drift toward high-density regions and leave airy pockets
    const dpx = densityField(p.pos.x + ge, p.pos.y, p.pos.z, t)
    const dnx = densityField(p.pos.x - ge, p.pos.y, p.pos.z, t)
    const dpy = densityField(p.pos.x, p.pos.y + ge, p.pos.z, t)
    const dny = densityField(p.pos.x, p.pos.y - ge, p.pos.z, t)
    const dpz = densityField(p.pos.x, p.pos.y, p.pos.z + ge, t)
    const dnz = densityField(p.pos.x, p.pos.y, p.pos.z - ge, t)
    tmpDensityGrad.set(
      (dpx - dnx) / (2 * ge),
      (dpy - dny) / (2 * ge),
      (dpz - dnz) / (2 * ge)
    )

    const dHere = densityField(p.pos.x, p.pos.y, p.pos.z, t)
    const airy = Math.max(0, -dHere)
    if (p.pos.lengthSq() > 0) {
      tmpDir.copy(p.pos).normalize()
      tmpDensityGrad.addScaledVector(tmpDir, airy * params.airyStrength)
    }
    tmpDensityGrad.multiplyScalar(params.clumpStrength)

    // Smaller local vortices inside the global flow
    tmpVortex.set(0, 0, 0)
    for (let vi = 0; vi < vortices.length; vi++) {
      const v = vortices[vi]
      const vr = Math.max(8, params.vortexRadius * v.radiusFactor)
      const vr2 = vr * vr

      tmpToVortex.copy(p.pos).sub(v.center)
      const d2 = tmpToVortex.lengthSq()
      if (d2 >= vr2 || d2 < 1e-10) continue

      const d = Math.sqrt(d2)
      const falloff = 1 - d / vr

      // slight temporal wobble of axis to feel organic
      const jt = t * 0.7 + v.seed
      tmpLocalAxis.copy(v.axis)
      tmpLocalAxis.x += noise3D(jt, v.seed, 0.0) * params.vortexAxisJitter
      tmpLocalAxis.y += noise3D(0.0, jt, v.seed) * params.vortexAxisJitter
      tmpLocalAxis.z += noise3D(v.seed, 0.0, jt) * params.vortexAxisJitter
      if (tmpLocalAxis.lengthSq() > 0) tmpLocalAxis.normalize()

      tmpTangential.crossVectors(tmpLocalAxis, tmpToVortex)
      if (tmpTangential.lengthSq() > 0) {
        const vortexAmp = params.vortexStrength * v.strengthFactor * falloff * falloff
        tmpTangential.normalize().multiplyScalar(vortexAmp)
        tmpVortex.add(tmpTangential)
      }
    }
    
    // Step 2: Get directional vector from curl noise
    tmpDesired
      .copy(curlVector)
      .add(tmpMediumCurl)
      .add(tmpMicroCurl)
      .add(tmpCirculation)
      .add(tmpVortex)
      .add(tmpRadial)
      .add(tmpDensityGrad)
    p.vel.lerp(tmpDesired, params.velocityResponse)
    p.vel.multiplyScalar(params.drag)
    
    // Step 3: Move particle in that direction
    p.pos.addScaledVector(p.vel, params.speed)
    
    // Step 4: Apply boundary constraints (continuous field - no randomness)
    if (params.volumeType === 'sphere') {
      const distFromCenter = p.pos.length()
      if (distFromCenter > 0) {
        tmpDir.copy(p.pos).multiplyScalar(1 / distFromCenter)
      }
      const localMaxRadius = maxRadius * organicRadiusMultiplier(tmpDir, t)
      if (distFromCenter > localMaxRadius) {
        // Gradient field: push particle back toward center smoothly
        const excess = distFromCenter - localMaxRadius
        p.pos.sub(tmpDir.multiplyScalar(excess * 0.8))
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
    gui.add(params, 'volumeSize', 50, 500, 10).onChange(() => { initParticles(); buildVortices() })
    gui.add(params, 'noiseScale', 0.001, 0.02, 0.001)
    gui.add(params, 'mediumCurlScale', 0.002, 0.03, 0.001).name('Medium scale')
    gui.add(params, 'mediumCurlStrength', 0, 1.5, 0.01).name('Medium strength')
    gui.add(params, 'microCurlScale', 0.01, 0.2, 0.001).name('Micro scale')
    gui.add(params, 'microCurlStrength', 0, 1.2, 0.01).name('Micro strength')
    gui.add(params, 'speed', 0.01, 0.5, 0.01)
    gui.add(params, 'flowCoherence', 0.8, 5, 0.1).name('Flow coherence')
    gui.add(params, 'velocityResponse', 0.01, 0.3, 0.01).name('Response')
    gui.add(params, 'drag', 0.85, 0.999, 0.001).name('Drag')
    gui.add(params, 'circulationStrength', 0, 1.5, 0.01).name('Circulation')
    gui.add(params, 'vortexCount', 10, 260, 1).name('Vortex count').onChange(() => buildVortices())
    gui.add(params, 'vortexRadius', 8, 120, 1).name('Vortex radius')
    gui.add(params, 'vortexStrength', 0, 2.5, 0.01).name('Vortex strength')
    gui.add(params, 'vortexAxisJitter', 0, 0.8, 0.01).name('Vortex jitter')
    gui.add(params, 'vortexSizeVariation', 0, 1.2, 0.01).name('Vortex size var').onChange(() => buildVortices())
    gui.add(params, 'vortexStrengthVariation', 0, 1.2, 0.01).name('Vortex power var').onChange(() => buildVortices())
    gui.add(params, 'densityFieldScale', 0.005, 0.05, 0.001).name('Density scale')
    gui.add(params, 'clumpStrength', 0, 1.2, 0.01).name('Clump strength')
    gui.add(params, 'airyStrength', 0, 1.0, 0.01).name('Airy strength')
    gui.add(params, 'shapeIrregularity', 0, 0.5, 0.01).name('Shape irregularity').onChange(() => initParticles())
    gui.add(params, 'shapeNoiseScale', 0.5, 8, 0.1).name('Shape scale').onChange(() => initParticles())
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