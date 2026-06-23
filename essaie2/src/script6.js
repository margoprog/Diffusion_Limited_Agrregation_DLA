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

    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(branch.x, branch.y, branch.z),
        new THREE.Vector3(nx, ny, nz)
    ])

    const line = new THREE.Line(geometry, material)

    scene.add(line)

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