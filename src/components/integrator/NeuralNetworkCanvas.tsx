import { useRef, useEffect } from 'react'
import gsap from 'gsap'

interface Node {
  x: number
  y: number
  baseX: number
  baseY: number
  vx: number
  vy: number
  radius: number
  pulsePhase: number
  pulseSpeed: number
}

interface Packet {
  x: number
  y: number
  targetX: number
  targetY: number
  progress: number
  speed: number
  fromNode: number
  toNode: number
  alpha: number
}

export default function NeuralNetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<Node[]>([])
  const rafRef = useRef<number>(0)
  const mouseRef = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const NODE_COUNT = 50
    const CONNECTION_DISTANCE = 140
    const nodes: Node[] = []
    const packets: Packet[] = []

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = container!.offsetWidth
      const h = container!.offsetHeight
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function initNodes() {
      const w = container!.offsetWidth
      const h = container!.offsetHeight
      nodes.length = 0
      for (let i = 0; i < NODE_COUNT; i++) {
        const x = Math.random() * w
        const y = Math.random() * h
        nodes.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: 2 + Math.random() * 2.5,
          pulsePhase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.008 + Math.random() * 0.012,
        })
      }
      nodesRef.current = nodes
    }

    function getConnectedNodes(fromIdx: number): number[] {
      const connected: number[] = []
      for (let i = 0; i < nodes.length; i++) {
        if (i === fromIdx) continue
        const dx = nodes[fromIdx].x - nodes[i].x
        const dy = nodes[fromIdx].y - nodes[i].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < CONNECTION_DISTANCE) {
          connected.push(i)
        }
      }
      return connected
    }

    function spawnPacket() {
      if (nodes.length === 0) return
      const fromIdx = Math.floor(Math.random() * nodes.length)
      const connected = getConnectedNodes(fromIdx)
      if (connected.length === 0) return
      const toIdx = connected[Math.floor(Math.random() * connected.length)]

      packets.push({
        x: nodes[fromIdx].x,
        y: nodes[fromIdx].y,
        targetX: nodes[toIdx].x,
        targetY: nodes[toIdx].y,
        progress: 0,
        speed: 0.005 + Math.random() * 0.01,
        fromNode: fromIdx,
        toNode: toIdx,
        alpha: 1,
      })
    }

    let packetSpawnTimer = 0

    function update() {
      const w = container!.offsetWidth
      const h = container!.offsetHeight
      const mouse = mouseRef.current

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]

        // Gentle drift
        node.x += node.vx
        node.y += node.vy

        // Mouse repulsion
        const mdx = node.x - mouse.x
        const mdy = node.y - mouse.y
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy)
        if (mDist < 200 && mDist > 0) {
          const force = (200 - mDist) / 200 * 0.5
          node.x += (mdx / mDist) * force
          node.y += (mdy / mDist) * force
        }

        // Keep in bounds with soft bounce
        if (node.x < 20) { node.x = 20; node.vx *= -1 }
        if (node.x > w - 20) { node.x = w - 20; node.vx *= -1 }
        if (node.y < 20) { node.y = 20; node.vy *= -1 }
        if (node.y > h - 20) { node.y = h - 20; node.vy *= -1 }

        // Pulse
        node.pulsePhase += node.pulseSpeed

        // Slight return to base
        node.x += (node.baseX - node.x) * 0.002
        node.y += (node.baseY - node.y) * 0.002
      }

      // Spawn packets
      packetSpawnTimer++
      if (packetSpawnTimer > 20) {
        packetSpawnTimer = 0
        if (Math.random() > 0.3) spawnPacket()
        if (Math.random() > 0.5) spawnPacket()
      }

      // Update packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i]
        p.progress += p.speed
        if (p.progress >= 1) {
          packets.splice(i, 1)
          continue
        }
        p.x = nodes[p.fromNode].x + (nodes[p.toNode].x - nodes[p.fromNode].x) * p.progress
        p.y = nodes[p.fromNode].y + (nodes[p.toNode].y - nodes[p.fromNode].y) * p.progress
      }
    }

    function draw() {
      const w = container!.offsetWidth
      const h = container!.offsetHeight
      ctx!.clearRect(0, 0, w, h)

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECTION_DISTANCE) {
            const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.15
            ctx!.beginPath()
            ctx!.moveTo(nodes[i].x, nodes[i].y)
            ctx!.lineTo(nodes[j].x, nodes[j].y)
            ctx!.strokeStyle = `rgba(90, 143, 94, ${alpha})`
            ctx!.lineWidth = 0.8
            ctx!.stroke()
          }
        }
      }

      // Draw packets
      for (const p of packets) {
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(122, 175, 126, ${0.9 * (1 - p.progress)})`
        ctx!.fill()
      }

      // Draw nodes
      for (const node of nodes) {
        const pulse = Math.sin(node.pulsePhase) * 0.3 + 0.7
        const r = node.radius * pulse

        // Glow
        const glow = ctx!.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 4)
        glow.addColorStop(0, `rgba(90, 143, 94, ${0.2 * pulse})`)
        glow.addColorStop(1, 'rgba(90, 143, 94, 0)')
        ctx!.beginPath()
        ctx!.arc(node.x, node.y, r * 4, 0, Math.PI * 2)
        ctx!.fillStyle = glow
        ctx!.fill()

        // Core
        ctx!.beginPath()
        ctx!.arc(node.x, node.y, r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(90, 143, 94, ${0.7 + pulse * 0.3})`
        ctx!.fill()
      }
    }

    function animate() {
      update()
      draw()
      rafRef.current = requestAnimationFrame(animate)
    }

    function handleMouseMove(e: MouseEvent) {
      const rect = container!.getBoundingClientRect()
      mouseRef.current.x = e.clientX - rect.left
      mouseRef.current.y = e.clientY - rect.top
    }

    resize()
    initNodes()
    animate()

    window.addEventListener('resize', () => {
      resize()
      initNodes()
    })
    container.addEventListener('mousemove', handleMouseMove)

    // Fade in
    gsap.fromTo(canvas, { opacity: 0 }, { opacity: 1, duration: 1.5, ease: 'power2.out' })

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      container.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />
    </div>
  )
}
