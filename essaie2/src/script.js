// Minimal clean Lightning Tree — multicolor Canvas2D
(function(){
  const canvas = document.querySelector('canvas.webgl') || (() => {
    const c = document.createElement('canvas')
    c.className = 'webgl'
    document.body.style.margin = '0'
    document.body.style.background = '#000'
    document.body.appendChild(c)
    return c
  })()
  const ctx = canvas.getContext('2d')

  function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; ctx.lineCap='round'; ctx.lineJoin='round' }
  addEventListener('resize', resize, { passive: true })
  resize()

  const rand = (a,b) => a + Math.random() * (b - a)
  let branches = []
  let segments = []

  const params = { step:16, angleJitter:0.7, branchProb:0.38, initialLife:150, splitLifeFactor:0.62, lineWidth:1.8, saturation:0.82, lightness:0.58, curveStrength:1.4, fadeAlpha:0.02, stepsPerFrame:1, maxSegments:8000, seedSpread:220 }

  function seedBranch(x){
    const sx = (typeof x === 'number') ? x : (canvas.width/2 + rand(-params.seedSpread, params.seedSpread))
    branches.push({ x: sx, y: 24, angle: Math.PI/2, life: params.initialLife, depth:0, age:0 })
  }

  function reset(){ branches=[]; segments=[]; seedBranch(canvas.width/2); ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height) }

  function hslCss(h,s,l){ return `hsl(${Math.round(h)} ${Math.round(s*100)}% ${Math.round(l*100)}%)` }

  function getYRange(){
    if(segments.length === 0) return { min: 0, max: canvas.height }
    let min = Infinity, max = -Infinity
    for(let i=0;i<segments.length;i++){
      const s = segments[i]
      const my = (s.y1 + s.y2) * 0.5
      if(my < min) min = my
      if(my > max) max = my
    }
    return { min, max }
  }

  // drawSegment accepts optional global range for Y mapping
  function drawSegment(s, idx = 0, total = 1, globalY = null){
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1
    const len = Math.hypot(dx,dy) || 1
    const uy = dy/len
    const lightFactor = 0.15 * ((-uy + 1)/2)
    const l = Math.min(1, Math.max(0, params.lightness + lightFactor))

    // determine global Y range and compute t based on segment midpoint Y
    let t = 0
    if(globalY){
      const midY = (s.y1 + s.y2) * 0.5
      const minY = globalY.min
      const maxY = globalY.max
      const range = (maxY - minY) || 1
      t = (midY - minY) / range
    }
    // map hue from red (0°) to blue (240°) based on global t
    const hue = 0 + t * 240
    const h = (hue + ((s.depth||0)*3) + ((s.age||0)*0.02) + 360) % 360

    ctx.strokeStyle = hslCss(h, params.saturation, l)
    ctx.lineWidth = params.lineWidth

    // draw as a quadratic curve for smoother branches
    const mx = (s.x1 + s.x2) * 0.5
    const my = (s.y1 + s.y2) * 0.5
    const nx = -dy / (len || 1)
    const ny = dx / (len || 1)
    const curvature = params.curveStrength * (len * 0.12) / (1 + (s.depth || 0))
    const cx = mx + nx * curvature
    const cy = my + ny * curvature
    ctx.beginPath()
    ctx.moveTo(s.x1, s.y1)
    ctx.quadraticCurveTo(cx, cy, s.x2, s.y2)
    ctx.stroke()
  }

  function stepBranches(){
    const alive = []
    // compute global Y range once per step to avoid O(n^2)
    const globalY = getYRange()
    for(let i=0;i<branches.length;i++){
      const b = branches[i]
      if(b.life<=0) continue
      const nx = b.x + Math.cos(b.angle)*params.step
      const ny = b.y + Math.sin(b.angle)*params.step
      const seg = { x1:b.x,y1:b.y,x2:nx,y2:ny,depth:b.depth||0,age:b.age||0 }
      segments.push(seg)
      // draw with global mapping (uses precomputed globalY)
      drawSegment(seg, segments.length - 1, segments.length, globalY)
      b.x = nx; b.y = ny; b.angle += rand(-params.angleJitter, params.angleJitter); b.life--; b.age = (b.age||0)+1
      if(Math.random() < params.branchProb && b.life > 2){ const childLife = Math.max(2, Math.floor(b.life * params.splitLifeFactor)); alive.push({ x:b.x,y:b.y,angle:b.angle+rand(-0.6,0.6),life:childLife,depth:(b.depth||0)+1,age:0 }) }
      if(b.life>0) alive.push(b)
    }
    branches = alive
    // prune old segments to avoid unbounded memory growth during continuous runs
    if(segments.length > params.maxSegments){
      const remove = segments.length - params.maxSegments
      segments.splice(0, remove)
    }
  }

  function redrawSegments(){ ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height); const globalY = getYRange(); for(let i=0;i<segments.length;i++) drawSegment(segments[i], i, segments.length, globalY) }

  import('lil-gui').then(mod=>{ try{
      const GUI = mod.default
      const gui = new GUI({ width:300 })
      const folder = gui.addFolder('controls')
      folder.add(params,'step',1,40,1).name('Step')
      folder.add(params,'angleJitter',0,1,0.01).name('Angle jitter')
      folder.add(params,'branchProb',0,1,0.001).name('Branch prob')
      folder.add(params,'initialLife',4,800,1).name('Initial life')
      folder.add(params,'splitLifeFactor',0,1,0.01).name('Split life')
      folder.add(params,'lineWidth',0.2,8,0.1).name('Line width').onChange(v=>{params.lineWidth=v;redrawSegments()})
      folder.add(params,'saturation',0,1,0.01).name('Saturation').onChange(redrawSegments)
      folder.add(params,'lightness',0,1,0.01).name('Lightness').onChange(redrawSegments)
      folder.add(params,'fadeAlpha',0,0.2,0.005).name('Fade alpha')
      folder.add(params,'stepsPerFrame',1,8,1).name('Steps/frame')
      const actions={Stop:()=>stopLoop(),Start:()=>startLoop(),Reset:()=>{reset();startLoop()}}
      gui.add(actions,'Stop').name('Stop')
      gui.add(actions,'Start').name('Start')
      gui.add(actions,'Reset').name('Reset')
      // close the controls folder so it's collapsed by default, and close the GUI
      try{ folder.close(); gui.close() }catch(e){ /* ignore if API differs */ }
  }catch(e){console.warn('GUI failed',e)} }).catch(()=>{})

  let running=false
  function startLoop(){ if(running) return; running=true; requestAnimationFrame(loop) }
  function stopLoop(){ running=false }
  function loop(){ if(!running) return; ctx.fillStyle=`rgba(0,0,0,${params.fadeAlpha})`; ctx.fillRect(0,0,canvas.width,canvas.height); for(let i=0;i<params.stepsPerFrame;i++) stepBranches(); // if no active branches, seed a new one to keep animation continuous
    if(branches.length===0){ seedBranch() }
    requestAnimationFrame(loop) }

  reset(); startLoop()
  addEventListener('keydown', e=>{ if(e.key==='r'||e.key==='R'){ reset(); startLoop() } if(e.key==='s'||e.key==='S') stopLoop(); if(e.key==='g'||e.key==='G') startLoop() })
  window.LightningParams = params
  window.LightningSave = ()=>{ const url = canvas.toDataURL('image/png'); const a=document.createElement('a'); a.href=url; a.download='lightning.png'; a.click() }

})()