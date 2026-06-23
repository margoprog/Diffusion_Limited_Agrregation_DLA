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

  const params = { step:16, angleJitter:0.7, branchProb:0.38, initialLife:150, splitLifeFactor:0.62, lineWidth:1.8, saturation:0.82, lightness:0.58 }

  function reset(){ branches=[]; segments=[]; branches.push({ x: canvas.width/2, y: 24, angle: Math.PI/2, life: params.initialLife, depth:0, age:0 }); ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height) }

  function hslCss(h,s,l){ return `hsl(${Math.round(h)} ${Math.round(s*100)}% ${Math.round(l*100)}%)` }

  function drawSegment(s){
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1
    const angle = Math.atan2(dy, dx)
    const hue = ((angle / (2*Math.PI)) + 0.5) * 360
    const hueShift = (s.depth||0)*3 + (s.age||0)*0.02
    const h = (hue + hueShift + 360) % 360
    const len = Math.hypot(dx,dy) || 1
    const uy = dy/len
    const lightFactor = 0.15 * ((-uy + 1)/2)
    const l = Math.min(1, Math.max(0, params.lightness + lightFactor))
    ctx.strokeStyle = hslCss(h, params.saturation, l)
    ctx.lineWidth = params.lineWidth
    ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.stroke()
  }

  function stepBranches(){
    const alive = []
    for(let i=0;i<branches.length;i++){
      const b = branches[i]
      if(b.life<=0) continue
      const nx = b.x + Math.cos(b.angle)*params.step
      const ny = b.y + Math.sin(b.angle)*params.step
      const seg = { x1:b.x,y1:b.y,x2:nx,y2:ny,depth:b.depth||0,age:b.age||0 }
      drawSegment(seg); segments.push(seg)
      b.x = nx; b.y = ny; b.angle += rand(-params.angleJitter, params.angleJitter); b.life--; b.age = (b.age||0)+1
      if(Math.random() < params.branchProb && b.life > 2){ const childLife = Math.max(2, Math.floor(b.life * params.splitLifeFactor)); alive.push({ x:b.x,y:b.y,angle:b.angle+rand(-0.6,0.6),life:childLife,depth:(b.depth||0)+1,age:0 }) }
      if(b.life>0) alive.push(b)
    }
    branches = alive
  }

  function redrawSegments(){ ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height); for(let s of segments) drawSegment(s) }

  import('lil-gui').then(mod=>{ try{ const GUI = mod.default; const gui = new GUI({ width:300 }); gui.add(params,'step',1,40,1).name('Step'); gui.add(params,'angleJitter',0,1,0.01).name('Angle jitter'); gui.add(params,'branchProb',0,1,0.001).name('Branch prob'); gui.add(params,'initialLife',4,800,1).name('Initial life'); gui.add(params,'splitLifeFactor',0,1,0.01).name('Split life'); gui.add(params,'lineWidth',0.2,8,0.1).name('Line width').onChange(v=>{params.lineWidth=v;redrawSegments()}); gui.add(params,'saturation',0,1,0.01).name('Saturation').onChange(redrawSegments); gui.add(params,'lightness',0,1,0.01).name('Lightness').onChange(redrawSegments); const actions={Stop:()=>stopLoop(),Start:()=>startLoop(),Reset:()=>{reset();startLoop()}}; gui.add(actions,'Stop').name('Stop'); gui.add(actions,'Start').name('Start'); gui.add(actions,'Reset').name('Reset') }catch(e){console.warn('GUI failed',e)} }).catch(()=>{})

  let running=false
  function startLoop(){ if(running) return; running=true; requestAnimationFrame(loop) }
  function stopLoop(){ running=false }
  function loop(){ if(!running) return; ctx.fillStyle='rgba(0,0,0,0.06)'; ctx.fillRect(0,0,canvas.width,canvas.height); for(let i=0;i<2;i++) stepBranches(); if(branches.length===0){ running=false; return } requestAnimationFrame(loop) }

  reset(); startLoop()
  addEventListener('keydown', e=>{ if(e.key==='r'||e.key==='R'){ reset(); startLoop() } if(e.key==='s'||e.key==='S') stopLoop(); if(e.key==='g'||e.key==='G') startLoop() })
  window.LightningParams = params
  window.LightningSave = ()=>{ const url = canvas.toDataURL('image/png'); const a=document.createElement('a'); a.href=url; a.download='lightning.png'; a.click() }

})()