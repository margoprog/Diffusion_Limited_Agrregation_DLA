// 3D Particle Cloud with Curl Noise 3D
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { createNoise3D } from 'simplex-noise'

const canvas = document.querySelector('canvas.webgl')
const noise3D = createNoise3D()
const texture = new THREE.TextureLoader().load('/textures/particles/3.png')

// Scene setup
const scene = new THREE.Scene()
// scene.background = new THREE.Color(0x000000)

const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 1000)
camera.position.set(0, -120, 260)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))

// OrbitControls for mouse rotation and zoom
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.autoRotate = false

// Parameters
const params = {
  particleCount: 18000,
  volumeType: 'sphere',
  volumeSize: 200,
  noiseScale: 0.01,
  speed: 0.14,
  pointSize: 0.55,
  warpStrength: 0.08,
  warpScale: 0.005,
  flowCoherence: 2.5,
  drag: 0.985,
  circulationStrength: 0.35,
  vortexCount: 140,
  vortexRadius: 36,
  vortexStrength: 0.7,
  trailLength: 18,
  trailOpacity: 0.12
}

const fixed = {
  timeSpeed: 0.2,
  mediumCurlScale: 0.008,
  mediumCurlStrength: 0.55,
  microCurlScale: 0.06,
  microCurlStrength: 0.28,
  velocityResponse: 0.045,
  vortexAxisJitter: 0.25,
  vortexSizeVariation: 0.7,
  vortexStrengthVariation: 0.8,
  densityFieldScale: 0.015,
  clumpStrength: 0.08,
  airyStrength: 0.24,
  densityContrast: 1.0,
  densityBias: 0.12,
  voidBias: 0.1,
  shapeIrregularity: 0.18,
  shapeNoiseScale: 3.2,
  inwardStrength: 0.02,
  equilibriumRadiusRatio: 0.42,
  envelopeStrength: 0.28,
  coreRepelStrength: 0.2,
  centerStability: 0.1,
  emergencyRadiusFactor: 1.35,
  trailUpdateSkip: 2,
  vortexStride: 2,
  densitySampleStride: 2
}

let simTime = 0
let frameCount = 0

const scratch = {
  center: new THREE.Vector3(0, 0, 0),
  centerDrift: new THREE.Vector3(),
  warpA: new THREE.Vector3(),
  warpB: new THREE.Vector3(),
  warpC: new THREE.Vector3(),
  curlA: new THREE.Vector3(),
  curlB: new THREE.Vector3(),
  curlC: new THREE.Vector3()
}

const frameScratch = {
  centerOfMass: new THREE.Vector3(),
  desired: new THREE.Vector3(),
  circulation: new THREE.Vector3(),
  vortex: new THREE.Vector3(),
  toVortex: new THREE.Vector3(),
  localAxis: new THREE.Vector3(),
  tangential: new THREE.Vector3(),
  radial: new THREE.Vector3(),
  densityGrad: new THREE.Vector3(),
  dir: new THREE.Vector3(),
  envelope: new THREE.Vector3(),
  centerDrift: new THREE.Vector3(),
  mediumCurl: new THREE.Vector3(),
  microCurl: new THREE.Vector3()
}

// Curl Noise 3D: compute curl of noise field (∇ × F)
function curlNoise3D(x, y, z, out, eps = 0.001) {
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

  out.set(curl_x, curl_y, curl_z)
  const lenSq = out.lengthSq()
  if (lenSq > 1e-10) out.multiplyScalar(1 / Math.sqrt(lenSq))
  return out
}

// Domain Warping: distort coordinates using noise for more complex patterns
function domainWarp(x, y, z, time, out) {
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

  out.set(
    wx + warp2_x * params.warpScale,
    wy + warp2_y * params.warpScale,
    wz + warp2_z * params.warpScale
  )
  return out
}

// Scalar density field used to create denser and airier regions
function densityField(x, y, z, t) {
  const s = fixed.densityFieldScale
  const n1 = noise3D(x * s + t * 0.05, y * s, z * s)
  const n2 = noise3D(x * s * 2 + 17.3, y * s * 2 - 9.1, z * s * 2 + t * 0.09) * 0.5
  const n3 = noise3D(x * s * 4 - 23.7, y * s * 4 + 5.4, z * s * 4 - t * 0.12) * 0.25
  return (n1 + n2 + n3) / 1.75
}

// Non-linear potential: creates few strong sinks (clumps) and larger empty pockets
function densityPotential(d) {
  const cd = Math.max(0, d - fixed.densityBias)
  const vd = Math.max(0, -d - fixed.voidBias)
  const attract = (cd * cd) * fixed.clumpStrength * fixed.densityContrast
  const repel = (vd * vd) * fixed.airyStrength * fixed.densityContrast
  return attract - repel
}

// Organic boundary multiplier in direction space (breaks perfect sphere)
function organicRadiusMultiplier(dir, t) {
  const s = fixed.shapeNoiseScale
  const n1 = noise3D(dir.x * s + t * 0.11, dir.y * s, dir.z * s)
  const n2 = noise3D(dir.x * s * 2 + 13.7, dir.y * s * 2 - 4.2, dir.z * s * 2 + t * 0.07) * 0.5
  const n = (n1 + n2) / 1.5
  return 1 + n * fixed.shapeIrregularity
}

let particles = []
let geometry, material, points, colors
let trailGeometry, trailMaterial, trailLines
let trailState, trailSegments
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

    const radiusFactor = 1 - fixed.vortexSizeVariation * 0.5 + hash01(i * 3.11 + 9.3) * fixed.vortexSizeVariation
    const strengthFactor = 1 - fixed.vortexStrengthVariation * 0.5 + hash01(i * 5.93 + 4.7) * fixed.vortexStrengthVariation

    vortices.push({ center, axis, seed: i * 17.123, radiusFactor, strengthFactor })
  }
}

function initParticles() {
  if (points) scene.remove(points)
  if (trailLines) scene.remove(trailLines)

  buildVortices()
  
  particles = []
  const positions = new Float32Array(params.particleCount * 3)
  const colorArray = new Float32Array(params.particleCount * 3)
  const t = simTime * fixed.timeSpeed
  const halfVol = params.volumeSize * 0.5
  
  for (let i = 0; i < params.particleCount; i++) {
    let x, y, z
    
    if (params.volumeType === 'sphere') {
      // Start from a non-spherical cloud: sphere shape should emerge from dynamics
      x = (Math.random() - 0.5) * params.volumeSize
      y = (Math.random() - 0.5) * params.volumeSize
      z = (Math.random() - 0.5) * params.volumeSize
    } else {
      x = (Math.random() - 0.5) * params.volumeSize
      y = (Math.random() - 0.5) * params.volumeSize
      z = (Math.random() - 0.5) * params.volumeSize
    }
    
    const pPos = new THREE.Vector3(x, y, z)
    const seedBase = domainWarp(pPos.x * params.noiseScale, pPos.y * params.noiseScale, pPos.z * params.noiseScale, t, scratch.warpA)
    const seedMedium = domainWarp(pPos.x * fixed.mediumCurlScale, pPos.y * fixed.mediumCurlScale, pPos.z * fixed.mediumCurlScale, t * 0.7, scratch.warpB)
    const seedMicro = domainWarp(
      pPos.x * fixed.microCurlScale + 31.7,
      pPos.y * fixed.microCurlScale - 19.4,
      pPos.z * fixed.microCurlScale + 7.9,
      t * 1.6,
      scratch.warpC
    )
    const pVel = new THREE.Vector3().copy(curlNoise3D(seedBase.x, seedBase.y, seedBase.z, scratch.curlA))
      .add(curlNoise3D(seedMedium.x, seedMedium.y, seedMedium.z, scratch.curlB).multiplyScalar(fixed.mediumCurlStrength))
      .add(curlNoise3D(seedMicro.x, seedMicro.y, seedMicro.z, scratch.curlC).multiplyScalar(fixed.microCurlStrength))
      .multiplyScalar(0.25)

    particles.push({ pos: pPos, vel: pVel, densityGrad: new THREE.Vector3() })
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
    // initial color based on Y position (3-stop gradient: #2deaa2 -> #ff69bb -> #74b3f6)
    const ty = Math.min(1, Math.max(0, (y + halfVol) / params.volumeSize))
    // RGB: start=(45,234,162), mid=(255,105,187), end=(116,179,246)
    const mixMid = (a, b, t) => a * (1 - t) + b * t
    let rr, gg, bb
    if (ty <= 0.5) {
      const tt = ty * 2
      rr = mixMid(45, 255, tt)
      gg = mixMid(234, 105, tt)
      bb = mixMid(162, 187, tt)
    } else {
      const tt = (ty - 0.5) * 2
      rr = mixMid(255, 116, tt)
      gg = mixMid(105, 179, tt)
      bb = mixMid(187, 246, tt)
    }
    colorArray[i * 3] = rr / 255
    colorArray[i * 3 + 1] = gg / 255
    colorArray[i * 3 + 2] = bb / 255
  }
  
  geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  // per-vertex colors
  colors = colorArray
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  
  material = new THREE.PointsMaterial({
    // base color ignored when using vertexColors
    size: params.pointSize,
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 0.65,
    alphaTest: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  
  points = new THREE.Points(geometry, material)
  scene.add(points)

  // Build trajectory ribbons (streamlines) as dynamic line segments
  const L = Math.max(2, Math.floor(params.trailLength))
  trailState = {
    length: L,
    head: new Uint16Array(params.particleCount), // next write index per particle
    positions: new Float32Array(params.particleCount * L * 3)
  }

  // initialize trail history with current particle positions (avoids startup rays)
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i].pos
    const base = i * L * 3
    for (let j = 0; j < L; j++) {
      const k = base + j * 3
      trailState.positions[k] = p.x
      trailState.positions[k + 1] = p.y
      trailState.positions[k + 2] = p.z
    }
  }

  // each trail has (L - 1) segments, each segment has 2 vertices (x,y,z)
  trailSegments = new Float32Array(params.particleCount * (L - 1) * 2 * 3)
  trailGeometry = new THREE.BufferGeometry()
  const trailAttr = new THREE.BufferAttribute(trailSegments, 3)
  trailAttr.setUsage(THREE.DynamicDrawUsage)
  trailGeometry.setAttribute('position', trailAttr)

  trailMaterial = new THREE.LineBasicMaterial({
    color: 0x9fd3ff,
    transparent: true,
    opacity: params.trailOpacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })

  trailLines = new THREE.LineSegments(trailGeometry, trailMaterial)
  scene.add(trailLines)
}

function updateTrails() {
  if (!trailState || !trailSegments) return

  const L = trailState.length
  let out = 0

  for (let i = 0; i < particles.length; i++) {
    const particleBase = i * L
    const historyBase = particleBase * 3
    const oldest = trailState.head[i] // head is next write, so oldest sample

    for (let s = 0; s < L - 1; s++) {
      const a = (oldest + s) % L
      const b = (oldest + s + 1) % L

      const ia = historyBase + a * 3
      const ib = historyBase + b * 3

      trailSegments[out++] = trailState.positions[ia]
      trailSegments[out++] = trailState.positions[ia + 1]
      trailSegments[out++] = trailState.positions[ia + 2]

      trailSegments[out++] = trailState.positions[ib]
      trailSegments[out++] = trailState.positions[ib + 1]
      trailSegments[out++] = trailState.positions[ib + 2]
    }
  }

  trailGeometry.attributes.position.needsUpdate = true
}

function updateParticles() {
  const positions = geometry.attributes.position.array
  const maxRadius = params.volumeSize * 0.5
  const equilibriumRadius = params.volumeSize * fixed.equilibriumRadiusRatio
  const coreRadius = equilibriumRadius * 0.25
  const emergencyRadius = equilibriumRadius * fixed.emergencyRadiusFactor
  const center = scratch.center
  const centerOfMass = frameScratch.centerOfMass
  const tmpDesired = frameScratch.desired
  const tmpCirculation = frameScratch.circulation
  const tmpVortex = frameScratch.vortex
  const tmpToVortex = frameScratch.toVortex
  const tmpLocalAxis = frameScratch.localAxis
  const tmpTangential = frameScratch.tangential
  const tmpRadial = frameScratch.radial
  const tmpDensityGrad = frameScratch.densityGrad
  const tmpDir = frameScratch.dir
  const tmpEnvelope = frameScratch.envelope
  const tmpCenterDrift = frameScratch.centerDrift
  const tmpMediumCurl = frameScratch.mediumCurl
  const tmpMicroCurl = frameScratch.microCurl
  const t = simTime * fixed.timeSpeed
  const vortexStride = Math.max(1, fixed.vortexStride | 0)
  const vortexPhase = frameCount % vortexStride
  const densityStride = Math.max(1, fixed.densitySampleStride | 0)
  const densityPhase = frameCount % densityStride
  const ge = Math.max(0.5, params.volumeSize * 0.01)

  const halfVol = params.volumeSize * 0.5
  // Compute center of mass to keep the whole cloud stable over long durations
  centerOfMass.set(0, 0, 0)
  for (let i = 0; i < particles.length; i++) {
    centerOfMass.add(particles[i].pos)
  }
  centerOfMass.multiplyScalar(1 / Math.max(1, particles.length))
  scratch.centerDrift.copy(center).sub(centerOfMass).multiplyScalar(fixed.centerStability)
  
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    
    // Step 0: Apply domain warping to distort the sampling coordinates
    const warpedPos = domainWarp(
      p.pos.x * params.noiseScale,
      p.pos.y * params.noiseScale,
      p.pos.z * params.noiseScale,
      t,
      scratch.warpA
    )
    
    // Step 1: Query curl noise field at warped position
    const curlVector = curlNoise3D(warpedPos.x, warpedPos.y, warpedPos.z, scratch.curlA)

    // Hierarchical turbulence: medium currents + tiny local vortices
    const mediumPos = domainWarp(
      p.pos.x * fixed.mediumCurlScale,
      p.pos.y * fixed.mediumCurlScale,
      p.pos.z * fixed.mediumCurlScale,
      t * 0.7,
      scratch.warpB
    )
    tmpMediumCurl.copy(curlNoise3D(mediumPos.x, mediumPos.y, mediumPos.z, scratch.curlB)).multiplyScalar(fixed.mediumCurlStrength)

    const microPos = domainWarp(
      p.pos.x * fixed.microCurlScale + 31.7,
      p.pos.y * fixed.microCurlScale - 19.4,
      p.pos.z * fixed.microCurlScale + 7.9,
      t * 1.6,
      scratch.warpC
    )
    tmpMicroCurl.copy(curlNoise3D(microPos.x, microPos.y, microPos.z, scratch.curlC)).multiplyScalar(fixed.microCurlStrength)

    // Large-scale circulation around Y axis to make visible currents
    tmpDir.copy(p.pos).sub(centerOfMass)
    const radius = tmpDir.length()
    const radialFactor = Math.max(0, 1 - radius / maxRadius)
    tmpCirculation.set(-tmpDir.z, 0, tmpDir.x)
    if (tmpCirculation.lengthSq() > 0) tmpCirculation.normalize()
    tmpCirculation.multiplyScalar(params.circulationStrength * radialFactor)

    // Gentle inward drift to keep stable circulation zones
    tmpRadial.copy(centerOfMass).sub(p.pos)
    if (tmpRadial.lengthSq() > 0) tmpRadial.normalize()
    tmpRadial.multiplyScalar(fixed.inwardStrength)

    // Global smooth envelope: keeps a persistent spherical volume as emergent attractor
    tmpEnvelope.set(0, 0, 0)
    if (radius > equilibriumRadius && radius > 1e-6) {
      const excess = (radius - equilibriumRadius) / equilibriumRadius
      tmpEnvelope.copy(tmpDir).normalize().multiplyScalar(-fixed.envelopeStrength * excess * excess)
    } else if (radius < coreRadius && radius > 1e-6) {
      const rep = 1 - radius / coreRadius
      tmpEnvelope.copy(tmpDir).normalize().multiplyScalar(fixed.coreRepelStrength * rep)
    }

    // Keep cloud centered (prevent slow drift/disintegration)
    tmpCenterDrift.copy(scratch.centerDrift)

    // Density shaping: sampled on alternating particle subsets for performance
    if ((i % densityStride) === densityPhase) {
      const dpx = densityPotential(densityField(p.pos.x + ge, p.pos.y, p.pos.z, t))
      const dnx = densityPotential(densityField(p.pos.x - ge, p.pos.y, p.pos.z, t))
      const dpy = densityPotential(densityField(p.pos.x, p.pos.y + ge, p.pos.z, t))
      const dny = densityPotential(densityField(p.pos.x, p.pos.y - ge, p.pos.z, t))
      const dpz = densityPotential(densityField(p.pos.x, p.pos.y, p.pos.z + ge, t))
      const dnz = densityPotential(densityField(p.pos.x, p.pos.y, p.pos.z - ge, t))
      tmpDensityGrad.set(
        (dpx - dnx) / (2 * ge),
        (dpy - dny) / (2 * ge),
        (dpz - dnz) / (2 * ge)
      )

      const dHere = densityField(p.pos.x, p.pos.y, p.pos.z, t)
      const airy = Math.max(0, -dHere - fixed.voidBias)
      if (p.pos.lengthSq() > 0) {
        tmpDir.copy(p.pos).normalize()
        tmpDensityGrad.addScaledVector(tmpDir, airy * fixed.airyStrength * 0.25)
      }
      p.densityGrad.copy(tmpDensityGrad)
    } else {
      tmpDensityGrad.copy(p.densityGrad).multiplyScalar(0.985)
      p.densityGrad.copy(tmpDensityGrad)
    }
    // keep the term bounded to avoid exploding velocities
    const dgLen = tmpDensityGrad.length()
    if (dgLen > 1.2) tmpDensityGrad.multiplyScalar(1.2 / dgLen)

    // Smaller local vortices inside the global flow
    tmpVortex.set(0, 0, 0)
    for (let vi = vortexPhase; vi < vortices.length; vi += vortexStride) {
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
      tmpLocalAxis.x += noise3D(jt, v.seed, 0.0) * fixed.vortexAxisJitter
      tmpLocalAxis.y += noise3D(0.0, jt, v.seed) * fixed.vortexAxisJitter
      tmpLocalAxis.z += noise3D(v.seed, 0.0, jt) * fixed.vortexAxisJitter
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
      .add(tmpEnvelope)
      .add(tmpCenterDrift)
      .add(tmpDensityGrad)
    p.vel.lerp(tmpDesired, fixed.velocityResponse)
    p.vel.multiplyScalar(params.drag)
    
    // Step 3: Move particle in that direction
    p.pos.addScaledVector(p.vel, params.speed)

    // Append position to trail history
    if (trailState) {
      const L = trailState.length
      const h = trailState.head[i]
      const slot = (i * L + h) * 3
      trailState.positions[slot] = p.pos.x
      trailState.positions[slot + 1] = p.pos.y
      trailState.positions[slot + 2] = p.pos.z
      trailState.head[i] = (h + 1) % L
    }
    
    // Step 4: Apply boundary constraints (continuous field - no randomness)
    if (params.volumeType === 'sphere') {
      // Emergency guard only (rare): avoid numerical runaway after very long runs
      tmpDir.copy(p.pos).sub(centerOfMass)
      const distFromCenter = tmpDir.length()
      const localMaxRadius = emergencyRadius * organicRadiusMultiplier(tmpDir.normalize(), t)
      if (distFromCenter > localMaxRadius) {
        const pullBack = distFromCenter - localMaxRadius
        p.pos.addScaledVector(tmpDir, -pullBack)
        p.vel.multiplyScalar(0.6)
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
    // update color based on current Y position (3-stop gradient)
    if (colors) {
      const ty = Math.min(1, Math.max(0, (p.pos.y + halfVol) / params.volumeSize))
      const mixMid = (a, b, t) => a * (1 - t) + b * t
      let rr, gg, bb
      if (ty <= 0.5) {
        const tt = ty * 2
        rr = mixMid(45, 255, tt)
        gg = mixMid(234, 105, tt)
        bb = mixMid(162, 187, tt)
      } else {
        const tt = (ty - 0.5) * 2
        rr = mixMid(255, 116, tt)
        gg = mixMid(105, 179, tt)
        bb = mixMid(187, 246, tt)
      }
      colors[i * 3] = rr / 255
      colors[i * 3 + 1] = gg / 255
      colors[i * 3 + 2] = bb / 255
    }
  }
  
  geometry.attributes.position.needsUpdate = true
  if (geometry.attributes.color) geometry.attributes.color.needsUpdate = true
  if ((frameCount % fixed.trailUpdateSkip) === 0) updateTrails()
  simTime += 0.01
  frameCount++
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
    gui.add(params, 'particleCount', 2000, 50000, 100).onChange(() => initParticles())
    gui.add(params, 'volumeType', ['cube', 'sphere']).onChange(() => initParticles())
    gui.add(params, 'volumeSize', 50, 500, 10).onChange(() => { initParticles(); buildVortices() })
    gui.add(params, 'noiseScale', 0.001, 0.02, 0.001)
    gui.add(params, 'speed', 0.01, 0.5, 0.01)
    gui.add(params, 'flowCoherence', 0.8, 5, 0.1).name('Flow coherence')
    gui.add(params, 'drag', 0.85, 0.999, 0.001).name('Drag')
    gui.add(params, 'circulationStrength', 0, 1.5, 0.01).name('Circulation')
    gui.add(params, 'vortexCount', 10, 260, 1).name('Vortex count').onChange(() => buildVortices())
    gui.add(params, 'vortexRadius', 8, 120, 1).name('Vortex radius')
    gui.add(params, 'vortexStrength', 0, 2.5, 0.01).name('Vortex strength')
    gui.add(params, 'pointSize', 0.1, 4, 0.05).onChange(v => material.size = v)
    gui.add(params, 'trailLength', 4, 40, 1).name('Trail length').onChange(() => initParticles())
    gui.add(params, 'trailOpacity', 0.02, 0.6, 0.01).name('Trail opacity').onChange(v => {
      if (trailMaterial) trailMaterial.opacity = v
    })
    gui.add(params, 'warpStrength', 0, 1, 0.01).name('Warp strength')
    gui.add(params, 'warpScale', 0.001, 0.05, 0.001).name('Warp scale')
    gui.close()
  } catch (e) { console.warn('GUI failed', e) }
}).catch(() => {})

initParticles()
animate()