import { useEffect, useRef } from 'react';

export type OrbState = 'idle' | 'thinking' | 'checking' | 'answered';

interface Props { state?: OrbState; intro?: boolean; className?: string }

// Violet palette from the brief (rgb triplets).
const COLORS = [[133, 54, 245], [183, 148, 255], [228, 215, 255]];

export default function DanAiOrb({ state = 'idle', intro = false, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<OrbState>(state);
  const rippleRef = useRef(0);

  useEffect(() => {
    if (state === 'answered' && stateRef.current !== 'answered') rippleRef.current = performance.now();
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.innerWidth < 640;
    const N = mobile ? 450 : 900;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const pts = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = golden * i;
      return {
        x: Math.cos(t) * r, y, z: Math.sin(t) * r,
        c: COLORS[i % 7 === 0 ? 2 : i % 3 === 0 ? 1 : 0],
        sx: (Math.random() - 0.5) * 4, sy: (Math.random() - 0.5) * 4,
        seed: Math.random() * Math.PI * 2,
      };
    });

    let w = 0, h = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    let rot = 0, speed = 1, tight = 1, raf = 0, last = performance.now();
    const start = performance.now();
    const tilt = 0.35, ct = Math.cos(tilt), st = Math.sin(tilt);

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      const s = stateRef.current;
      const targetSpeed = s === 'thinking' ? 3 : s === 'checking' ? 1.6 : 1;
      speed += (targetSpeed - speed) * (1 - Math.exp(-4 * dt));
      tight += ((s === 'checking' ? 0.92 : 1) - tight) * (1 - Math.exp(-4 * dt));
      if (!reduced) rot += dt * 0.25 * speed;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const breathe = reduced ? 1 : 1 + 0.015 * (1 + Math.sin((now / 4000) * Math.PI * 2));
      const R = Math.min(w, h) * 0.36 * breathe * tight;
      const introP = intro && !reduced ? Math.min((now - start) / 1200, 1) : 1;
      const ease = 1 - Math.pow(1 - introP, 3);

      // glow
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.5);
      g.addColorStop(0, 'rgba(133,54,245,0.22)'); g.addColorStop(1, 'rgba(133,54,245,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      const cr = Math.cos(rot), sr = Math.sin(rot);
      const proj: { x: number; y: number; z: number; c: number[]; i: number }[] = [];
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        let x = p.x * cr + p.z * sr, z = -p.x * sr + p.z * cr, y = p.y;
        const y2 = y * ct - z * st; z = y * st + z * ct; y = y2;
        let jitter = 1;
        if (s === 'thinking' && !reduced) jitter = 1 + 0.04 * Math.sin(now / 120 + p.seed * 5);
        const px = cx + x * R * jitter, py = cy + y * R * jitter;
        proj.push({
          x: px * ease + (cx + p.sx * w * 0.5) * (1 - ease),
          y: py * ease + (cy + p.sy * h * 0.5) * (1 - ease),
          z, c: p.c, i,
        });
      }

      // neural lines on front side
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(133,54,245,0.08)';
      ctx.beginPath();
      const md = (R * 0.16) ** 2;
      for (let i = 0; i < N; i += 3) {
        const a = proj[i]; if (a.z < 0.2) continue;
        for (let j = i + 1; j < Math.min(i + 40, N); j++) {
          const b = proj[j]; if (b.z < 0.2) continue;
          const dx = a.x - b.x, dy = a.y - b.y;
          if (dx * dx + dy * dy < md) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
        }
      }
      ctx.stroke();

      proj.sort((a, b) => a.z - b.z);
      const pulse = (now / 900) % (Math.PI * 2);
      for (const q of proj) {
        const depth = (q.z + 1) / 2;
        let alpha = 0.15 + depth * 0.8;
        let size = (0.6 + depth * 1.6) * Math.max(R / 120, 0.5);
        if (s === 'thinking' && !reduced) {
          const lat = pts[q.i].y * 3 + pulse * 2;
          const b = Math.max(0, Math.cos(lat)) ** 8;
          alpha = Math.min(1, alpha + b * 0.6); size *= 1 + b * 0.6;
        }
        ctx.fillStyle = `rgba(${q.c[0]},${q.c[1]},${q.c[2]},${alpha * ease + 0.1 * (1 - ease)})`;
        ctx.beginPath(); ctx.arc(q.x, q.y, size, 0, Math.PI * 2); ctx.fill();
      }

      if (s === 'checking') {
        const a = now / 700;
        ctx.strokeStyle = 'rgba(133,54,245,0.55)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.25, R * 0.35, Math.sin(a * 0.5) * 0.6, 0, Math.PI * 2); ctx.stroke();
        const ox = cx + Math.cos(a) * R * 1.25, oy = cy + Math.sin(a) * R * 0.35;
        ctx.fillStyle = 'rgba(133,54,245,0.9)'; ctx.beginPath(); ctx.arc(ox, oy, 2.5, 0, Math.PI * 2); ctx.fill();
      }

      const rp = (now - rippleRef.current) / 1200;
      if (rippleRef.current && rp < 1) {
        ctx.strokeStyle = `rgba(133,54,245,${0.4 * (1 - rp)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, R * (1 + rp * 0.6), 0, Math.PI * 2); ctx.stroke();
      }

      if (!reduced || introP < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, [intro]);

  return <canvas ref={canvasRef} className={`block w-full h-full ${className}`} aria-hidden="true" />;
}
