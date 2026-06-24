import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * Scene
 */
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(
    75,
    sizes.width / sizes.height,
    0.1,
    2000
)

camera.position.set(0, 100, 300)

scene.add(camera)

/**
 * Renderer
 */
const canvas = document.querySelector('canvas.webgl')

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true
})

renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

/**
 * Controls
 */
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Light
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 1)
scene.add(ambientLight)

const pointLight = new THREE.PointLight(0xffffff, 3)
pointLight.position.set(100, 200, 100)
scene.add(pointLight)

/**
 * Lightning Tree Parameters
 */
const params = {
    step: 8,
    initialLife: 120,
    branchProbability: 0.12,
    splitFactor: 0.7,
    yawJitter: 0.35,
    pitchJitter: 0.25
}

const material = new THREE.LineBasicMaterial({
    color: 0xffffff
})

const rand = (min, max) =>
{
    return min + Math.random() * (max - min)
}

// collect particle positions for vertex coloring
const positions = []
// collect line segment positions for a single LineSegments buffer
const linePositions = []

/**
 * Branch Structure
 */
const branches = []

branches.push({
    x: 0,
    y: -150,
    z: 0,

    yaw: 0,
    pitch: Math.PI / 2,

    life: params.initialLife
})

/**
 * Generate Tree
 */
while(branches.length > 0)
{
    const branch = branches.shift()

    if(branch.life <= 0)
        continue

    const dx =
        Math.cos(branch.yaw) *
        Math.sin(branch.pitch) *
        params.step

    const dy =
        Math.cos(branch.pitch) *
        params.step

    const dz =
        Math.sin(branch.yaw) *
        Math.sin(branch.pitch) *
        params.step

    const nx = branch.x + dx
    const ny = branch.y + dy
    const nz = branch.z + dz

    // store both endpoints as particles (so every segment contributes two vertices)
    positions.push(branch.x, branch.y, branch.z)
    positions.push(nx, ny, nz)

    // build a small smooth curve for this segment
    const p0 = new THREE.Vector3(branch.x, branch.y, branch.z)
    const p2 = new THREE.Vector3(nx, ny, nz)
    // midpoint
    const mid = new THREE.Vector3().addVectors(p0, p2).multiplyScalar(0.5)
    // direction and a perpendicular for offset
    const dir = new THREE.Vector3().subVectors(p2, p0).normalize()
    let normal = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
    if (normal.length() < 0.001) normal = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(1, 0, 0)).normalize()
    const offset = params.step * 0.6 * (Math.random() * 0.8 - 0.4)
    mid.addScaledVector(normal, offset)

    const curve = new THREE.CatmullRomCurve3([p0, mid, p2])
    const curvePoints = curve.getPoints(8)
    // append consecutive point pairs to the shared linePositions array (LineSegments)
    for (let j = 0; j < curvePoints.length - 1; j++) {
        const a = curvePoints[j]
        const b = curvePoints[j + 1]
        linePositions.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }

    branch.x = nx
    branch.y = ny
    branch.z = nz

    branch.yaw += rand(
        -params.yawJitter,
        params.yawJitter
    )

    branch.pitch += rand(
        -params.pitchJitter,
        params.pitchJitter
    )

    branch.life--

    if(
        Math.random() < params.branchProbability &&
        branch.life > 5
    )
    {
        branches.push({
            x: branch.x,
            y: branch.y,
            z: branch.z,

            yaw:
                branch.yaw +
                rand(-1, 1),

            pitch:
                branch.pitch +
                rand(-0.8, 0.8),

            life:
                Math.floor(
                    branch.life *
                    params.splitFactor
                )
        })
    }

    if(branch.life > 0)
    {
        branches.push(branch)
    }
}

/**
 * Grid Helper
 */
const grid = new THREE.GridHelper(
    1000,
    50,
    0x444444,
    0x222222
)

scene.add(grid)

/**
 * Create colored points from generated positions
 * Build HSL -> RGB gradient across all particles (0° -> 360°)
 */
if (positions.length > 0) {
    const particleCount = positions.length / 3
    const colors = []

    // map hue based on camera-space depth so vertices in front are red, behind are blue
    const tmp = new THREE.Vector3()
    let minZ = Infinity, maxZ = -Infinity
    for (let i = 0; i < particleCount; i++) {
        tmp.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
        tmp.applyMatrix4(camera.matrixWorldInverse)
        const z = tmp.z
        if (z < minZ) minZ = z
        if (z > maxZ) maxZ = z
    }
    const rangeZ = (maxZ - minZ) || 1
    for (let i = 0; i < particleCount; i++) {
        tmp.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
        tmp.applyMatrix4(camera.matrixWorldInverse)
        const z = tmp.z
        const t = (z - minZ) / rangeZ // 0..1 (0 = nearest/front)
        const hue = t * 240 // 0° (red) -> 240° (blue)
        const color = new THREE.Color()
        color.setHSL(hue / 360, 1, 0.5)
        colors.push(color.r, color.g, color.b)
    }

    const pointsGeometry = new THREE.BufferGeometry()
    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    pointsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    const pointsMaterial = new THREE.PointsMaterial({ size: 2, vertexColors: true })
    const points = new THREE.Points(pointsGeometry, pointsMaterial)
    scene.add(points)
    // Build a single LineSegments from collected linePositions to reduce draw calls
    if (linePositions.length > 0) {
        const lineGeom = new THREE.BufferGeometry()
        lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff })
        const lines = new THREE.LineSegments(lineGeom, lineMat)
        scene.add(lines)
    }
}

/**
 * Resize
 */
window.addEventListener('resize', () =>
{
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    camera.aspect =
        sizes.width / sizes.height

    camera.updateProjectionMatrix()

    renderer.setSize(
        sizes.width,
        sizes.height
    )
})

/**
 * Animate
 */
const tick = () =>
{
    controls.update()

    renderer.render(scene, camera)

    requestAnimationFrame(tick)
}

tick()