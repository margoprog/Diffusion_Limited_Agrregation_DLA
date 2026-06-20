import * as THREE from 'three'

// 7 torus wireframes randomly distributed on white background
(function(){
  const canvas = document.querySelector('canvas.webgl') || (() => {
    const c = document.createElement('canvas')
    c.className = 'webgl'
    document.body.style.margin = '0'
    document.body.appendChild(c)
    return c
  })()

  // ensure black page + canvas background
  document.documentElement.style.backgroundColor = '#000000'
  document.body.style.background = '#000000'
  canvas.style.background = '#000000'

  const sizes = { width: window.innerWidth, height: window.innerHeight }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 1)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)

  const camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 1000)
  camera.position.set(0, 0, 18)
  scene.add(camera)

  // create 7 wireframe toruses
  const toruses = []
  for (let i = 0; i < 7; i++) {
    const radius = 1 + Math.random() * 2.2 // main radius
    const tube = Math.max(0.15, radius * (0.12 + Math.random() * 0.12))
    const radialSeg = 24
    const tubularSeg = 120

    const geo = new THREE.TorusGeometry(radius, tube, radialSeg, tubularSeg)
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0xffffff })
    )

    // random placement in a loose volume
    wire.position.x = (Math.random() - 0.5) * 18
    wire.position.y = (Math.random() - 0.5) * 10
    wire.position.z = (Math.random() - 0.5) * 18

    // random scale & initial rotation
    const s = 0.8 + Math.random() * 1.8
    wire.scale.set(s, s, s)
    wire.rotation.x = Math.random() * Math.PI
    wire.rotation.y = Math.random() * Math.PI
    wire.rotation.z = Math.random() * Math.PI

    // store a gentle rotation speed
    const speed = (Math.random() * 0.6 + 0.2) * (Math.random() > 0.5 ? 1 : -1)

    scene.add(wire)
    toruses.push({ mesh: wire, speed })
  }

  // responsive
  window.addEventListener('resize', () => {
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  })

  // simple animation loop
  const clock = new THREE.Clock()
  function animate() {
    const dt = clock.getDelta()
    for (const t of toruses) {
      t.mesh.rotation.x += t.speed * dt * 0.5
      t.mesh.rotation.y += t.speed * dt * 0.7
    }
    renderer.render(scene, camera)
    requestAnimationFrame(animate)
  }

  animate()

})()
