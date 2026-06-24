// Curl Noise — black lines on white background
import { createNoise2D } from 'simplex-noise'

const canvas = document.querySelector('canvas.webgl') || (() => {
  const c = document.createElement('canvas')
  c.className = 'webgl'
  document.body.style.margin = '0'
  document.body.style.background = '#fff'
  document.body.appendChild(c)
  return c
})()

const ctx = canvas.getContext('2d')
const noise2D = createNoise2D()

function resize() {
  canvas.width = innerWidth
  canvas.height = innerHeight
}

addEventListener('resize', resize, { passive: true })
resize()

// Parameters
const params = {
  particleCount: 80,
  scale: 0.008,
  speed: 0.15,
  trailLength: 15,
  lineWidth: 1.5,
  time: 0
}

// Curl Noise function
function curlNoise(x, y, eps = 0.001) {
  const n1 = noise2D(x, y + eps)
  const n2 = noise2D(x, y - eps)
  const a = (n1 - n2) / (2 * eps)

  const n3 = noise2D(x + eps, y)
  const n4 = noise2D(x - eps, y)
  const b = (n3 - n4) / (2 * eps)

  return { x: a, y: -b }
}

// Particle system
const particles = []

function initParticles() {
  particles.length = 0
  for (let i = 0; i < params.particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      trail: []
    })
  }
}

function updateParticles() {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    const flow = curlNoise(
      (p.x + params.time) * params.scale,
      (p.y + params.time) * params.scale
    )
    
    p.x += flow.x * params.speed
    p.y += flow.y * params.speed
    
    // Wrap around screen
    if (p.x < 0) p.x += canvas.width
    if (p.x > canvas.width) p.x -= canvas.width
    if (p.y < 0) p.y += canvas.height
    if (p.y > canvas.height) p.y -= canvas.height
    
    // Store trail point
    p.trail.push({ x: p.x, y: p.y })
    if (p.trail.length > params.trailLength) p.trail.shift()
  }
  params.time += 0.5
}

function draw() {
  // Draw white background (clear)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  
  // Draw particle trails in black
  ctx.strokeStyle = '#000'
  ctx.lineWidth = params.lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    if (p.trail.length < 2) continue
    
    ctx.beginPath()
    ctx.moveTo(p.trail[0].x, p.trail[0].y)
    for (let j = 1; j < p.trail.length; j++) {
      ctx.lineTo(p.trail[j].x, p.trail[j].y)
    }
    ctx.stroke()
  }
}

function animate() {
  updateParticles()
  draw()
  requestAnimationFrame(animate)
}

// Simple GUI for live tuning
import('lil-gui').then(mod => {
  try {
    const GUI = mod.default
    const gui = new GUI({ width: 300 })
    gui.add(params, 'particleCount', 10, 500, 1).onChange(() => initParticles())
    gui.add(params, 'scale', 0.001, 0.05, 0.001).name('Noise scale')
    gui.add(params, 'speed', 0.01, 0.5, 0.01)
    gui.add(params, 'trailLength', 2, 60, 1).name('Trail length')
    gui.add(params, 'lineWidth', 0.1, 5, 0.1).name('Line width')
    gui.close()
  } catch (e) {
    console.warn('GUI failed', e)
  }
}).catch(() => {})

initParticles()
animate()
