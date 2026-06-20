import * as THREE from 'three'

// Three.js particle spiral with GLSL shader animated by sinusoids
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

  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 2000)
  camera.position.z = 400

  // Parameters
  let POINT_COUNT = 6000
  let TURNS = 10
  const MAX_RADIUS = 200

  // Geometry & attributes
  let pointsMesh = null

  function makeSpiral(count = POINT_COUNT, turns = TURNS){
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const offsets = new Float32Array(count)
    const sizes = new Float32Array(count)

    for(let i = 0; i < count; i++){
      const t = i / (count - 1)
      const angle = t * turns * Math.PI * 2
      const radius = t * MAX_RADIUS
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      const z = 0
      positions[i * 3 + 0] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      offsets[i] = Math.random() * Math.PI * 2
      sizes[i] = 1.0 + Math.random() * 2.0
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    return geometry
  }

  const vertexShader = `
    precision mediump float;
    uniform float uTime;
    uniform float uSize;
    uniform float uMaxRadius;
    attribute float aOffset;
    attribute float aSize;
    varying float vDist;

    void main(){
      vec3 pos = position;
      float phase = aOffset;
      // sinusoidal displacement based on time and radius
      float r = length(pos.xy);
      float s = sin(uTime * 2.0 + phase + r * 0.08);
      float amp = (1.0 - r / uMaxRadius);
      pos.z += s * 30.0 * amp;

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // point size scales with distance and an attribute size
      float sizeFactor = uSize * aSize * (1.0 + s * 0.4);
      gl_PointSize = sizeFactor * (300.0 / -mvPosition.z);

      vDist = r;
    }
  `

  const fragmentShader = `
    precision mediump float;
    uniform vec3 uColor;
    uniform float uMaxRadius;
    varying float vDist;

    void main(){
      vec2 uv = gl_PointCoord - vec2(0.5);
      float d = length(uv);
      float alpha = smoothstep(0.5, 0.0, d);
      float fade = 1.0 - (vDist / uMaxRadius);
      gl_FragColor = vec4(uColor, alpha * fade);
    }
  `

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 6.0 },
      uColor: { value: new THREE.Color(1,1,1) },
      uMaxRadius: { value: MAX_RADIUS }
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })

  function createPoints(){
    if(pointsMesh) scene.remove(pointsMesh)
    const geo = makeSpiral(POINT_COUNT, TURNS)
    pointsMesh = new THREE.Points(geo, material)
    scene.add(pointsMesh)
  }

  createPoints()

  // Resize
  function resize(){
    const w = window.innerWidth
    const h = window.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  }
  addEventListener('resize', resize, { passive: true })
  resize()

  // Animation
  const clock = new THREE.Clock()
  function animate(){
    const t = clock.getElapsedTime()
    material.uniforms.uTime.value = t
    renderer.render(scene, camera)
    requestAnimationFrame(animate)
  }
  animate()

  // Keys: R to randomize parameters
  addEventListener('keydown', (e) => {
    if(e.key === 'r' || e.key === 'R'){
      TURNS = 3 + Math.floor(Math.random() * 15)
      POINT_COUNT = 3000 + Math.floor(Math.random() * 8000)
      material.uniforms.uSize.value = 3.0 + Math.random() * 6.0
      material.uniforms.uMaxRadius.value = MAX_RADIUS
      createPoints()
    }
  })

})()