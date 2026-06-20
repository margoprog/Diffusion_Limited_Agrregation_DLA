// Œuvre Bauhaus noir et blanc — grille qui se libère en mouvement mécanique
(function(){
  const canvas = document.querySelector('canvas.webgl') || (() => {
    const c = document.createElement('canvas')
    c.className = 'webgl'
    document.body.style.margin = '0'
    document.body.appendChild(c)
    return c
  })()

  const ctx = canvas.getContext('2d', { alpha: false })

  const DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))

  let W = window.innerWidth
  let H = window.innerHeight

  function resize(){
    W = window.innerWidth
    H = window.innerHeight
    canvas.width = Math.floor(W * DPR)
    canvas.height = Math.floor(H * DPR)
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  }
  window.addEventListener('resize', resize)
  resize()

  // Configuration de la grille
  const cols = 10
  const rows = Math.max(6, Math.floor(cols * (H / W)))
  const padding = Math.min(W, H) * 0.06
  const gridW = W - padding * 2
  const gridH = H - padding * 2
  const cellW = gridW / cols
  const cellH = gridH / rows

  // Timing
  const start = performance.now()
  const totalDuration = 16000 // ms for full transition

  // Small deterministic PRNG for reproducible layout
  let seed = 12345
  function rand() { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 0) / 4294967295) }

  // Easing
  function easeInOut(t){ return t<0.5 ? 2*t*t : -1 + (4-2*t)*t }

  // Draw primitives (black only)
  function drawSquare(x,y,s,rotation){
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rotation)
    ctx.fillRect(-s/2, -s/2, s, s)
    ctx.restore()
  }

  function drawCircle(x,y,r){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill() }

  function drawLine(x,y,len,angle,thickness){
    ctx.save()
    ctx.translate(x,y)
    ctx.rotate(angle)
    ctx.fillRect(-len/2, -thickness/2, len, thickness)
    ctx.restore()
  }

  // For each cell, compute a small randomization seed and delay so motion propagates
  const cells = []
  for(let j=0;j<rows;j++){
    for(let i=0;i<cols;i++){
      const cx = padding + (i + 0.5) * cellW
      const cy = padding + (j + 0.5) * cellH
      const tdelay = (i/cols)*400 + (j/rows)*300 + rand()*300
      const type = (i + j) % 3 // 0:square,1:circle,2:line
      const rnd = rand()
      cells.push({i,j,cx,cy,tdelay,type,rnd})
    }
  }

  // Animation loop
  function render(){
    const now = performance.now()
    const elapsed = now - start
    // background white
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0,0,W,H)

    ctx.fillStyle = '#000000'
    ctx.lineCap = 'round'

    // Draw grid guide lightly (thin lines) for first phase
    const guideProgress = Math.max(0, 1 - elapsed / (totalDuration * 0.6))
    if(guideProgress > 0.01){
      ctx.save(); ctx.globalAlpha = 0.06 * guideProgress
      for(let g=0; g<=cols; g++){
        const x = padding + g * cellW
        ctx.fillRect(x-0.5, padding, 1, gridH)
      }
      for(let g=0; g<=rows; g++){
        const y = padding + g * cellH
        ctx.fillRect(padding, y-0.5, gridW, 1)
      }
      ctx.restore()
    }

    // Each cell animates from strict grid to liberated motion
    cells.forEach(cell => {
      const localT = Math.max(0, elapsed - cell.tdelay)
      const progress = Math.min(1, localT / (totalDuration * 0.6))
      const eased = easeInOut(progress)

      // base position
      const baseX = cell.cx
      const baseY = cell.cy

      // liberation offset: combines radial mechanical motion and small chaos
      const angle = (cell.i + cell.j) * 0.6 + elapsed * 0.0008 * (1 + cell.rnd*2)
      const magnitude = (Math.min(1, elapsed / totalDuration) * 0.6 + eased * 1.2) * Math.min(cellW,cellH) * 0.28
      const offX = Math.cos(angle + cell.rnd*6.28) * magnitude * eased
      const offY = Math.sin(angle*0.7 + cell.rnd*6.28) * magnitude * eased

      const x = baseX + offX
      const y = baseY + offY

      // size modulation
      const maxSize = Math.min(cellW, cellH) * 0.6
      const size = (0.45 + 0.55 * (1 - cell.rnd)) * maxSize * (0.8 + 0.4 * eased)

      // rotation for square/line
      const rot = (cell.rnd - 0.5) * 0.6 * (1 - progress) + eased * (cell.rnd - 0.5) * Math.PI

      // mechanical jitter (small snap motion) for later phase
      const mech = Math.sin(elapsed * 0.002 + cell.rnd*10) * 0.03 * Math.min(1, elapsed/2000)

      // Draw depending on type
      if(cell.type === 0){
        // square
        ctx.save(); ctx.globalAlpha = 1
        drawSquare(x, y + mech*cellH, size, rot)
        ctx.restore()
      } else if(cell.type === 1){
        // circle
        ctx.save(); ctx.globalAlpha = 1
        drawCircle(x, y + mech*cellH, size*0.45)
        ctx.restore()
      } else {
        // line
        ctx.save(); ctx.globalAlpha = 1
        drawLine(x, y + mech*cellH, size*1.4, rot + Math.PI/2, Math.max(2, size*0.12))
        ctx.restore()
      }
    })

    // Overlapping bold composition lines to create balance
    ctx.save()
    ctx.globalAlpha = 0.08 + 0.6 * Math.min(1, elapsed / totalDuration)
    const centerX = W/2, centerY = H/2
    // a few large mechanical lines
    drawLine(centerX, centerY, Math.min(W,H)*0.9, elapsed*0.0006 % (Math.PI), 6)
    drawLine(centerX*0.6, centerY*0.6, Math.min(W,H)*0.6, Math.PI/2 + (elapsed*0.0003 % (Math.PI)), 6)
    ctx.restore()

    requestAnimationFrame(render)
  }

  render()

  // Optional: click to reset seed and restart motion
  canvas.addEventListener('click', () => { seed = Math.floor(Math.random()*1e9); /* slight re-randomization */ })

})();
import * as THREE from 'three'

// Ensure canvas exists
let canvas = document.querySelector('canvas.webgl')
if (!canvas) {
  canvas = document.createElement('canvas')
  canvas.className = 'webgl'
  document.body.style.margin = '0'
  document.body.appendChild(canvas)
}

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xffffff)

// Sizes
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
}

// Camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(0, 0, 3)
scene.add(camera)

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

// (Cube removed)

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.4)
scene.add(ambient)
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
dirLight.position.set(2, 2, 2)
scene.add(dirLight)

// Resize handling
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight
  camera.aspect = sizes.width / sizes.height
  camera.updateProjectionMatrix()
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
})

// Animation
const clock = new THREE.Clock()
function animate() {
  const elapsed = clock.getElapsedTime()
  renderer.render(scene, camera)
  requestAnimationFrame(animate)
}

animate()
