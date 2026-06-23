import GUI from 'lil-gui'
// Lightning Tree — simple iterative branching on a 2D canvas
 (function(){
  const canvas = document.querySelector('canvas.webgl') || (() => {
    const c = document.createElement('canvas')
    c.className = 'webgl'
    document.body.style.margin = '0'
    document.body.appendChild(c)
    return c
  })()

  const ctx = canvas.getContext('2d')
  document.documentElement.style.backgroundColor = '#000'
  document.body.style.background = '#000'

  function resize(){
    const w = window.innerWidth
    const h = window.innerHeight
    canvas.width = w
    canvas.height = h
    ctx.lineWidth = 1
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }
  addEventListener('resize', resize, { passive: true })
  resize()

  const rand = (a, b) => a + Math.random() * (b - a)

  // Branch structure
  let branches = []
  let segments = [] // store drawn segments so we can redraw when stopped

  const params = {
    step: 19,
    angleJitter: 0.9,
    branchProb: 0.4,
    initialLife: 140,
    splitLifeFactor: 0.63,
    lineWidth: 2.7,
    color: '#ffffff'
  }

  // helper: hex -> hsl
  function hexToHsl(hex) {
    const h = hex.replace('#','')
    const bigint = parseInt(h, 16)
    const r = (bigint >> 16) & 255
    const g = (bigint >> 8) & 255
    const b = bigint & 255
    const rf = r/255, gf = g/255, bf = b/255
    const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf)
    let hdeg = 0, s = 0, l = (max + min) / 2
    if(max !== min){
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch(max){
        case rf: hdeg = (gf - bf) / d + (gf < bf ? 6 : 0); break
        case gf: hdeg = (bf - rf) / d + 2; break
        case bf: hdeg = (rf - gf) / d + 4; break
      }
      hdeg = hdeg * 60
    }
    return { h: hdeg, s: s, l: l }
  }

  function hslToCss(h, s, l){
    return `hsl(${Math.round(h)} ${Math.round(s*100)}% ${Math.round(l*100)}%)`
  }

  // light direction (pointing up): segments pointing up get brighter
  const lightDir = { x: 0, y: -1 }

  function reset(){
    branches = []
    segments = []
    // start at top center, growing downward
    branches.push({
      x: canvas.width / 2,
      y: 20,
      angle: Math.PI/2,
      life: params.initialLife
    })
    // clear canvas
    ctx.fillStyle = '#000'
    ctx.fillRect(0,0,canvas.width, canvas.height)
  }

  // GUI
  try{
    const gui = new GUI({ width: 300 })
    const cStep = gui.add(params, 'step', 1, 40, 1).name('Step')
    const cAngle = gui.add(params, 'angleJitter', 0, 1, 0.01).name('Angle jitter')
    const cProb = gui.add(params, 'branchProb', 0, 1, 0.001).name('Branch prob')
    const cLife = gui.add(params, 'initialLife', 4, 800, 1).name('Initial life')
    const cSplit = gui.add(params, 'splitLifeFactor', 0, 1, 0.01).name('Split life')
    const cLine = gui.add(params, 'lineWidth', 0.2, 8, 0.1).name('Line width')
    const cColor = gui.addColor(params, 'color').name('Color')

    const redrawIfStopped = () => {
      if(branches.length === 0 && segments.length > 0) redrawSegments()
    }

    cStep.onChange(redrawIfStopped)
    cAngle.onChange(redrawIfStopped)
    cProb.onChange(redrawIfStopped)
    cLife.onChange(redrawIfStopped)
    cSplit.onChange(redrawIfStopped)
    cLine.onChange(v => { ctx.lineWidth = v; redrawIfStopped() })
    cColor.onChange(redrawIfStopped)
  }catch(e){
    console.warn('GUI failed', e)
  }

  reset()

  function stepBranches(){
    const alive = []
    for(let i=0;i<branches.length;i++){
      const b = branches[i]
      if(b.life <= 0) continue
      // advance
      const nx = b.x + Math.cos(b.angle) * params.step
      const ny = b.y + Math.sin(b.angle) * params.step

      // draw segment using vector-based spectrum hue (angle -> hue)
      ctx.lineWidth = params.lineWidth
      const dx = nx - b.x
      const dy = ny - b.y
      const angle = Math.atan2(dy, dx) // -PI..PI
      const hueNorm = (angle / (Math.PI * 2)) + 0.5 // 0..1
      const hueDeg = (hueNorm % 1) * 360
      // lightness modulated by orientation relative to lightDir
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const dot = ux * lightDir.x + uy * lightDir.y
      const lightFactor = 0.15 * ((dot + 1) / 2) // small lightness tweak
      const l = Math.min(1, Math.max(0, 0.6 + lightFactor))
      ctx.strokeStyle = hslToCss(hueDeg, 0.8, l)
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(nx, ny)
      ctx.stroke()
      // store segment for potential redraw when stopped
      segments.push({ x1: b.x, y1: b.y, x2: nx, y2: ny })

      b.x = nx
      b.y = ny
      b.angle += rand(-params.angleJitter, params.angleJitter)
      b.life -= 1

      // random split
      if(Math.random() < params.branchProb && b.life > 2){
        const childLife = Math.max(2, Math.floor(b.life * params.splitLifeFactor))
        const child = { x: b.x, y: b.y, angle: b.angle + rand(-0.6, 0.6), life: childLife }
        alive.push(child)
      }

      if(b.life > 0) alive.push(b)
    }
    branches = alive
  }

  let then = performance.now()
  function loop(now){
    const dt = (now - then)
    then = now
    // slight fade for glow
    ctx.fillStyle = 'rgba(0,0,0,0.06)'
    ctx.fillRect(0,0,canvas.width, canvas.height)

    // perform a few steps per frame for visible growth
    for(let i=0;i<2;i++) stepBranches()

    // if no branches alive, stop and leave final image
    if(branches.length === 0){
      return
    }

    requestAnimationFrame(loop)
  }

  requestAnimationFrame(loop)

  // controls
  addEventListener('keydown', (e) => {
    if(e.key === 'r' || e.key === 'R') reset()
  })

  // redraw stored segments with current visual params
  function redrawSegments(){
    ctx.fillStyle = '#000'
    ctx.fillRect(0,0,canvas.width, canvas.height)
    ctx.lineWidth = params.lineWidth
    for(let i=0;i<segments.length;i++){
      const s = segments[i]
      const dx = s.x2 - s.x1
      const dy = s.y2 - s.y1
      const angle = Math.atan2(dy, dx)
      const hueNorm = (angle / (Math.PI * 2)) + 0.5
      const hueDeg = (hueNorm % 1) * 360
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const dot = ux * lightDir.x + uy * lightDir.y
      const lightFactor = 0.15 * ((dot + 1) / 2)
      const l = Math.min(1, Math.max(0, 0.6 + lightFactor))
      ctx.strokeStyle = hslToCss(hueDeg, 0.8, l)
      ctx.beginPath()
      ctx.moveTo(s.x1, s.y1)
      ctx.lineTo(s.x2, s.y2)
      ctx.stroke()
    }
  }

  // expose params for console tweaking
  window.LightningParams = params

})()
