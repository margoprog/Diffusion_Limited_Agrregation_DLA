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

  const params = {
    step: 6,
    angleJitter: 0.3,
    branchProb: 0.05,
    initialLife: 120,
    splitLifeFactor: 0.6,
    lineWidth: 1.0,
    color: '#ffffff'
  }

  function reset(){
    branches = []
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
    gui.add(params, 'step', 1, 40, 1).name('Step')
    gui.add(params, 'angleJitter', 0, 1, 0.01).name('Angle jitter')
    gui.add(params, 'branchProb', 0, 1, 0.001).name('Branch prob')
    gui.add(params, 'initialLife', 4, 800, 1).name('Initial life').onChange(v => { /* new branches will use this */ })
    gui.add(params, 'splitLifeFactor', 0, 1, 0.01).name('Split life')
    gui.add(params, 'lineWidth', 0.2, 8, 0.1).name('Line width').onChange(v => { ctx.lineWidth = v })
    gui.addColor(params, 'color').name('Color')
  }catch(e){
    // ignore if GUI can't be created
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

      // draw segment using live params
      ctx.lineWidth = params.lineWidth
      ctx.strokeStyle = params.color
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.lineTo(nx, ny)
      ctx.stroke()

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

    // if no branches alive, restart after a short pause
    if(branches.length === 0){
      setTimeout(reset, 800)
    }

    requestAnimationFrame(loop)
  }

  requestAnimationFrame(loop)

  // controls
  addEventListener('keydown', (e) => {
    if(e.key === 'r' || e.key === 'R') reset()
  })

  // expose params for console tweaking
  window.LightningParams = params

})()
