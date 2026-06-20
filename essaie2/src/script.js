import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'

// 5000 particles moving randomly in a 3D cube using BufferGeometry
(function(){
	const canvas = document.querySelector('canvas.webgl') || (() => {
		const c = document.createElement('canvas')
		c.className = 'webgl'
		document.body.style.margin = '0'
		document.body.appendChild(c)
		return c
	})()

	document.documentElement.style.backgroundColor = '#000'
	document.body.style.background = '#000'
	canvas.style.display = 'block'

	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
	renderer.setClearColor(0x000000)
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

	const scene = new THREE.Scene()

	const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 5000)
	camera.position.z = 800

	// Controls: allow click+drag to move the scene
	const controls = new OrbitControls(camera, renderer.domElement)
	controls.enableDamping = true
	controls.dampingFactor = 0.08
	controls.enablePan = false
	controls.rotateSpeed = 0.9

	// Seed sphere at center representing the initial seed
	const seedRadius = 14 // base geometry radius, scaled to match particle pixels
	const seedGeometry = new THREE.SphereGeometry(seedRadius, 32, 16)
	const seedMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc00 })
	const seedMesh = new THREE.Mesh(seedGeometry, seedMaterial)
	seedMesh.position.set(0, 0, 0)
	scene.add(seedMesh)

	// Config
	const COUNT = 5000
	const BOUND = 300 // sphere radius for distribution and bounds
	// world-space seed radius (will be updated to match particle pixel size)
	let SEED_RADIUS = seedRadius
	let COLLIDE_DIST = SEED_RADIUS + 6
	let COLLIDE_DIST_SQ = COLLIDE_DIST * COLLIDE_DIST
	// Spatial hash grid for efficient neighbor checks (will be updated when seed radius changes)
	let CELL_SIZE = COLLIDE_DIST * 2.0

	// track maximum aggregated radius (for coloring by distance)
	let maxAggRadius = SEED_RADIUS
	const grid = new Map() // key -> array of aggregated indices

	function cellKeyFromPos(x, y, z){
		const ix = Math.floor((x + BOUND) / CELL_SIZE)
		const iy = Math.floor((y + BOUND) / CELL_SIZE)
		const iz = Math.floor((z + BOUND) / CELL_SIZE)
		return ix + ',' + iy + ',' + iz
	}

	function addAggregatedToGrid(index){
		const x = positions[index*3 + 0]
		const y = positions[index*3 + 1]
		const z = positions[index*3 + 2]
		const key = cellKeyFromPos(x,y,z)
		let arr = grid.get(key)
		if(!arr){ arr = []; grid.set(key, arr) }
		arr.push(index)

		// update max aggregated radius (distance in XY plane)
		const dxy = Math.sqrt(x*x + y*y)
		if(dxy > maxAggRadius) maxAggRadius = dxy
	}

	// compute seed world size so it visually equals twice a particle's pixel size
	function updateSeedWorldSize(){
		// desired pixel diameter = 2 * particle size
		const desiredPixels = Math.max(1, material.size) * 2
		// ensure renderer size is up to date
		const heightPx = renderer.domElement.height || renderer.domElement.clientHeight || window.innerHeight
		const fovRad = camera.fov * Math.PI / 180
		const dist = Math.max(0.0001, camera.position.distanceTo(seedMesh.position))
		// world diameter formula: world = projectedPixels * 2 * dist * tan(fov/2) / heightPixels
		const worldDiameter = desiredPixels * 2 * dist * Math.tan(fovRad / 2) / heightPx
		const worldRadius = worldDiameter / 2
		// scale mesh so its radius equals worldRadius
		const scale = worldRadius / seedGeometry.parameters.radius
		seedMesh.scale.setScalar(scale)
		// update collision distances and cell size
		SEED_RADIUS = worldRadius
		COLLIDE_DIST = SEED_RADIUS + 6
		COLLIDE_DIST_SQ = COLLIDE_DIST * COLLIDE_DIST
		CELL_SIZE = COLLIDE_DIST * 2.0
		// ensure maxAggRadius at least seed radius
		if(maxAggRadius < SEED_RADIUS) maxAggRadius = SEED_RADIUS
	}

	// Geometry
	const geometry = new THREE.BufferGeometry()
	const positions = new Float32Array(COUNT * 3)
	// velocities not stored as attributes to avoid shader-side mutation; keep in JS array
	const velocities = new Float32Array(COUNT * 3)
	// aggregated flags: 0 = free, 1 = stuck/aggregated
	const aggregated = new Uint8Array(COUNT)
	// per-vertex colors so aggregated particles can change color
	const colors = new Float32Array(COUNT * 3)

	// Initialize positions & velocities (uniform inside sphere)
	for(let i = 0; i < COUNT; i++){
		// sample radius with cubic root for uniform sphere
	 	const u = Math.random()
	 	const r = Math.cbrt(u) * BOUND
	 	const theta = Math.acos(2 * Math.random() - 1)
	 	const phi = Math.random() * Math.PI * 2
	 	const x = Math.sin(theta) * Math.cos(phi) * r
	 	const y = Math.sin(theta) * Math.sin(phi) * r
	 	const z = Math.cos(theta) * r

	 	positions[i*3 + 0] = x
	 	positions[i*3 + 1] = y
	 	positions[i*3 + 2] = z

	 	// velocity: random direction, small magnitude
	 	const vd = Math.random()
	 	const vr = (Math.random() * 2 - 1) * 0.5
	 	velocities[i*3 + 0] = (Math.random() * 2 - 1) * 0.5
	 	velocities[i*3 + 1] = (Math.random() * 2 - 1) * 0.5
	 	velocities[i*3 + 2] = (Math.random() * 2 - 1) * 0.5

	 	aggregated[i] = 0

	 	// initialize colors to white
	 	colors[i*3 + 0] = 1.0
	 	colors[i*3 + 1] = 1.0
	 	colors[i*3 + 2] = 1.0
	}

	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
	geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

	// load particle sprite from static files with onLoad/onError fallback
	const spriteLoader = new THREE.TextureLoader()
	let spriteTex = null
	const spriteUrl = 'textures/particles/2.png'
	console.log('[particles] loading sprite', spriteUrl)
	spriteLoader.load(
		spriteUrl,
		(tex) => {
			spriteTex = tex
			spriteTex.encoding = THREE.sRGBEncoding
			spriteTex.minFilter = THREE.LinearFilter
			if(points && points.material){
				points.material.map = spriteTex
				points.material.needsUpdate = true
			}
			console.log('[particles] sprite loaded')
		},
		undefined,
		(err) => {
			console.warn('[particles] failed to load sprite', spriteUrl, err)
			// keep using colored points without texture
		}
	)

	const material = new THREE.PointsMaterial({
		vertexColors: true,
		map: spriteTex,
		size: 4,
		sizeAttenuation: true,
		transparent: true,
		// lower alphaTest to properly clip tiny edges, disable depthWrite so blending looks correct
		alphaTest: 0.01,
		opacity: 0.95,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		premultipliedAlpha: false
	})

	const points = new THREE.Points(geometry, material)
	scene.add(points)

	// GUI controls
	const params = {
		size: material.size,
		dynamicHue: true,
		mode: 'angle', // 'angle' or 'height'
		saturation: 1.0,
		lightness: 0.5,
		// particle movement speed multiplier (world units/sec)
		speed: 60
	}
	// max aggregate radius (from center) in world units
	params.maxAggregateRadius = 60

	const gui = new GUI({ width: 260 })
	gui.add(params, 'size', 4, 12, 0.1).name('Particle size').onChange(v => { material.size = v; updateSeedWorldSize() })
	gui.add(params, 'dynamicHue').name('Dynamic hue')
	gui.add(params, 'mode', ['angle', 'height']).name('Hue mode')
	gui.add(params, 'saturation', 0, 1, 0.01).name('Saturation')
	gui.add(params, 'lightness', 0, 1, 0.01).name('Lightness')
	gui.add(params, 'maxAggregateRadius', 0, Math.min(BOUND, 600), 1).name('Max aggregate R')
	gui.add(params, 'speed', 0, 200, 1).name('Speed')
	// target cluster size and processing passes per frame
	params.targetCluster = 10000
	params.passesPerFrame = 4
	gui.add(params, 'targetCluster', 300, 50000, 1).name('Target cluster').onChange(v => { /* no-op */ })
	gui.add(params, 'passesPerFrame', 1, 200, 1).name('Passes/frame')

	function hslToRgb(h, s, l){
		// h in [0,360], s,l in [0,1]
		h /= 360
		let r, g, b
		if(s === 0){ r = g = b = l }
		else {
			const hue2rgb = (p, q, t) => {
				if(t < 0) t += 1
				if(t > 1) t -= 1
				if(t < 1/6) return p + (q - p) * 6 * t
				if(t < 1/2) return q
				if(t < 2/3) return p + (q - p) * (2/3 - t) * 6
				return p
			}
			const q = l < 0.5 ? l * (1 + s) : l + s - l * s
			const p = 2 * l - q
			r = hue2rgb(p, q, h + 1/3)
			g = hue2rgb(p, q, h)
			b = hue2rgb(p, q, h - 1/3)
		}
		return [r, g, b]
	}

	// Resize
	function resize(){
		const w = window.innerWidth
		const h = window.innerHeight
		camera.aspect = w / h
		camera.updateProjectionMatrix()
		renderer.setSize(w, h)
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
		// update seed size after resize
		updateSeedWorldSize()
	}
	addEventListener('resize', resize, { passive: true })
	resize()

	// Animation: update positions in-place, no new objects per frame
	const posAttr = geometry.getAttribute('position')
	let lastTime = performance.now()

	let aggregatedCount = 1 // seed counts as initial aggregated

	function updateSimulationPass(dt){
		let colorDirty = false
		for(let i = 0; i < COUNT; i++){
			const ix = i * 3
			if(aggregated[i]) continue // already stuck
			let x = positions[ix + 0]
			let y = positions[ix + 1]
			let z = positions[ix + 2]

			x += velocities[ix + 0] * params.speed * dt
			y += velocities[ix + 1] * params.speed * dt
			z += velocities[ix + 2] * params.speed * dt

			// spherical boundary: if outside radius, reflect velocity about normal
			const rr = x*x + y*y + z*z
			if(rr > BOUND * BOUND){
				const rlen = Math.sqrt(rr)
				const nx = x / rlen
				const ny = y / rlen
				const nz = z / rlen
				const vx = velocities[ix + 0]
				const vy = velocities[ix + 1]
				const vz = velocities[ix + 2]
				const vdotn = vx * nx + vy * ny + vz * nz
				velocities[ix + 0] = vx - 2 * vdotn * nx
				velocities[ix + 1] = vy - 2 * vdotn * ny
				velocities[ix + 2] = vz - 2 * vdotn * nz
				positions[ix + 0] = nx * BOUND
				positions[ix + 1] = ny * BOUND
				positions[ix + 2] = nz * BOUND
				continue
			}

			// check collision with nearby aggregated particles using spatial hash
			let collided = false

			// first check seed at origin (ensure initial aggregation)
			const dsqSeed = x*x + y*y + z*z
			if(dsqSeed <= COLLIDE_DIST_SQ){
				collided = true
			}

			if(!collided){
				const cx = Math.floor((x + BOUND) / CELL_SIZE)
				const cy = Math.floor((y + BOUND) / CELL_SIZE)
				const cz = Math.floor((z + BOUND) / CELL_SIZE)
				for(let dx = -1; dx <= 1 && !collided; dx++){
					for(let dy = -1; dy <= 1 && !collided; dy++){
						for(let dz = -1; dz <= 1 && !collided; dz++){
							const key = (cx+dx) + ',' + (cy+dy) + ',' + (cz+dz)
							const arr = grid.get(key)
							if(!arr) continue
							for(let j = 0; j < arr.length; j++){
								const idx = arr[j]
								const jx = idx * 3
								const dxp = positions[jx+0] - x
								const dyp = positions[jx+1] - y
								const dzp = positions[jx+2] - z
								const d2 = dxp*dxp + dyp*dyp + dzp*dzp
								if(d2 <= COLLIDE_DIST_SQ){ collided = true; break }
							}
						}
					}
				}
			}

			if(collided){
				aggregated[i] = 1
				velocities[ix + 0] = 0
				velocities[ix + 1] = 0
				velocities[ix + 2] = 0
				const maxR = Math.max(0, params.maxAggregateRadius)
				const u = Math.random()
				const r = Math.cbrt(u) * maxR
				const theta = Math.acos(2 * Math.random() - 1)
				const phi = Math.random() * Math.PI * 2
				const fx = Math.sin(theta) * Math.cos(phi) * r
				const fy = Math.sin(theta) * Math.sin(phi) * r
				const fz = Math.cos(theta) * r
				positions[ix + 0] = fx
				positions[ix + 1] = fy
				positions[ix + 2] = fz
				// update max aggregated radius considering XY distance
				const dxyAgg = Math.sqrt(fx*fx + fy*fy)
				if(dxyAgg > maxAggRadius) maxAggRadius = dxyAgg
				colors[ix + 0] = 1.0
				colors[ix + 1] = 0.8
				colors[ix + 2] = 0.2
				colorDirty = true
				addAggregatedToGrid(i)
				aggregatedCount++
				continue
			}

			positions[ix + 0] = x
			positions[ix + 1] = y
			positions[ix + 2] = z
		}

		posAttr.needsUpdate = true

		return colorDirty
	}

	function animate(){
		const now = performance.now()
		const dt = Math.min(0.05, (now - lastTime) / 1000) // seconds, clamp
		lastTime = now

		// Run up to params.passesPerFrame simulation passes or until target reached
		let passes = 0
		while(aggregatedCount < params.targetCluster && passes < params.passesPerFrame){
			updateSimulationPass(dt)
			passes++
		}

		// Always run one normal pass for animation responsiveness
		const colorDirty = updateSimulationPass(dt)

		// update colors based on placement (hue) if requested
		if(params.dynamicHue){
			const colAttr = geometry.getAttribute('color')
			// determine normalization radius: use current maxAggRadius (fallback to BOUND)
			const normRadius = Math.max(1e-3, maxAggRadius || params.maxAggregateRadius || BOUND)
			for(let i = 0; i < COUNT; i++){
				const ix = i * 3
				const x = positions[ix + 0]
				const y = positions[ix + 1]
				const dist = Math.sqrt(x*x + y*y)
				const t = Math.min(1, dist / normRadius)
				// map t in [0,1] to hue from 0.65 (violet/blue) down to 0 (red)
				const hueFrac = 0.65 - t * 0.65
				const hueDeg = hueFrac * 360
				const rgb = hslToRgb(hueDeg, params.saturation, params.lightness)
				colAttr.array[ix + 0] = rgb[0]
				colAttr.array[ix + 1] = rgb[1]
				colAttr.array[ix + 2] = rgb[2]
			}
			geometry.getAttribute('color').needsUpdate = true
		}

		controls.update()
		renderer.render(scene, camera)
		requestAnimationFrame(animate)
	}

	animate()

	// R to randomize velocities/positions
	addEventListener('keydown', (e) => {
		if(e.key === 'r' || e.key === 'R'){
			// reset grid & aggregated state
			grid.clear()
			for(let i = 0; i < COUNT; i++){
				const ix = i * 3
				// sample uniformly in sphere for reset
				const u = Math.random()
				const r = Math.cbrt(u) * BOUND
				const theta = Math.acos(2 * Math.random() - 1)
				const phi = Math.random() * Math.PI * 2
				positions[ix + 0] = Math.sin(theta) * Math.cos(phi) * r
				positions[ix + 1] = Math.sin(theta) * Math.sin(phi) * r
				positions[ix + 2] = Math.cos(theta) * r

				velocities[ix + 0] = (Math.random() * 2 - 1) * 0.5
				velocities[ix + 1] = (Math.random() * 2 - 1) * 0.5
				velocities[ix + 2] = (Math.random() * 2 - 1) * 0.5

				aggregated[i] = 0
				colors[ix + 0] = 1.0
				colors[ix + 1] = 1.0
				colors[ix + 2] = 1.0
			}
			aggregatedCount = 1
			// recompute seed/collision sizes
			updateSeedWorldSize()
			posAttr.needsUpdate = true
			geometry.getAttribute('color').needsUpdate = true
		}
	})

})()

