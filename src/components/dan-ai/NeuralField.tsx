import { useEffect, useRef } from 'react';

/**
 * Full-page neural network behind Dan AI: drifting nodes joined by faint lines.
 * While Dan AI is thinking the nodes speed up and signals race along the links.
 */
export default function NeuralField({ active = false }: { active?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, dpr = 1, raf = 0, last = performance.now(), energy = 0;
    type Node = { x: number; y: number; vx: number; vy: number; r: number };
    let nodes: Node[] = [];
    const pulses: { a: number; b: number; t: number; speed: number }[] = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      const n = Math.round(Math.min(90, (w * h) / 16000));
      nodes = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, r: 0.6 + Math.random() * 1.4,
      }));
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const LINK = 150;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      energy += ((activeRef.current ? 1 : 0) - energy) * (1 - Math.exp(-3 * dt));
      const speed = 1 + energy * 4;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      for (const p of nodes) {
        if (!reduced) { p.x += p.vx * dt * speed; p.y += p.vy * dt * speed; }
        if (p.x < -20) p.x = w + 20; if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20; if (p.y > h + 20) p.y = -20;
      }

      ctx.lineWidth = 0.6;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > LINK) continue;
          const o = (1 - d / LINK) * (0.12 + energy * 0.16);
          ctx.strokeStyle = `rgba(160,130,255,${o})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          if (!reduced && energy > 0.2 && pulses.length < 40 && Math.random() < 0.0025 * energy) pulses.push({ a: i, b: j, t: 0, speed: 0.8 + Math.random() * 1.2 });
        }
      }

      for (let k = pulses.length - 1; k >= 0; k--) {
        const q = pulses[k]; q.t += dt * q.speed;
        const a = nodes[q.a], b = nodes[q.b];
        if (q.t >= 1 || !a || !b || Math.hypot(a.x - b.x, a.y - b.y) > LINK) { pulses.splice(k, 1); continue; }
        const x = a.x + (b.x - a.x) * q.t, y = a.y + (b.y - a.y) * q.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 6);
        g.addColorStop(0, 'rgba(140,235,255,0.95)'); g.addColorStop(1, 'rgba(140,235,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      }

      for (const p of nodes) {
        ctx.fillStyle = `rgba(200,180,255,${0.35 + energy * 0.35})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onVis = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduced) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="fixed inset-0 w-full h-full -z-10 pointer-events-none" />;
}
