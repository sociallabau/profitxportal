import { useNavigate } from 'react-router-dom';
import { moduleName } from '@/data/modules';
import { MODULE_GATE, type GateNumber } from '@/lib/growthHub';

/**
 * The ProfitX model: Offer, Clients and Delivery, each wrapped in its stage 1
 * modules (inner ring) and stage 2 modules (outer ring). Every segment opens
 * its module. Rings are clipped along the lines between the circles, so the
 * three meet like Dan's diagram.
 */

const G = { x: 300, y: 301.67 };
const PILLARS = [
  { key: 'offer', label: 'OFFER', sub: 'SHARP OFFER', cx: 300, cy: 215, out: -90, inner: ['O1', 'O2', 'O3'], outer: ['O5', 'O4', 'O6'] },
  { key: 'clients', label: 'CLIENTS', sub: 'CONSISTENT SALES', cx: 225, cy: 345, out: 150, inner: ['C3', 'C2', 'C1'], outer: ['C6', 'C4', 'C5'] },
  { key: 'delivery', label: 'DELIVERY', sub: 'SIMPLIFIED DELIVERY', cx: 375, cy: 345, out: 30, inner: ['D1', 'D2', 'D3'], outer: ['D5', 'D6', 'D4'] },
];
const R = { core: 95, mid: 138, edge: 181 };
// Each pillar's region: everything closer to its centre than to the other two.
const far = (dx: number, dy: number) => `${G.x + dx * 40},${G.y + dy * 40}`;
const REGIONS: Record<string, string> = {
  offer: `${G.x},${G.y} ${far(37.5, -21.67)} 1600,-1600 -1000,-1600 ${far(-37.5, -21.67)}`,
  clients: `${G.x},${G.y} ${far(-37.5, -21.67)} -1600,1600 ${G.x},2000`,
  delivery: `${G.x},${G.y} ${G.x},2000 2000,1600 ${far(37.5, -21.67)}`,
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const CG = G.y - 215; // centre-to-middle distance, the same for all three circles

/** How far either side of its outward direction a ring at radius r stays visible before it meets its neighbour. */
function halfSpan(r: number) {
  const s = (CG + Math.sqrt(CG * CG - 4 * (CG * CG - r * r))) / 2;
  return (Math.atan2(CG - 0.5 * s, 0.866 * s) * 180) / Math.PI + 90;
}
const pt = (cx: number, cy: number, r: number, deg: number) => [cx + r * Math.cos(rad(deg)), cy + r * Math.sin(rad(deg))] as const;

function sector(cx: number, cy: number, r1: number, r2: number, a1: number, a2: number) {
  const [x1, y1] = pt(cx, cy, r2, a1), [x2, y2] = pt(cx, cy, r2, a2);
  const [x3, y3] = pt(cx, cy, r1, a2), [x4, y4] = pt(cx, cy, r1, a1);
  const large = a2 - a1 > 180 ? 1 : 0;
  return `M${x1},${y1} A${r2},${r2} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${r1},${r1} 0 ${large} 0 ${x4},${y4} Z`;
}

/** The arc text runs along, flipped on the lower half so it reads upright. */
function labelArc(cx: number, cy: number, r: number, a1: number, a2: number) {
  const mid = (((a1 + a2) / 2) % 360 + 360) % 360;
  const upright = mid > 0 && mid < 180;
  const [s, e] = upright ? [a2, a1] : [a1, a2];
  const [x1, y1] = pt(cx, cy, r, s), [x2, y2] = pt(cx, cy, r, e);
  return `M${x1},${y1} A${r},${r} 0 0 ${upright ? 0 : 1} ${x2},${y2}`;
}

export default function ProfitXModel({ gate }: { gate: GateNumber | null }) {
  const navigate = useNavigate();
  // Three segments per ring: a middle one ±31.5° and two side ones out to where the ring meets its neighbour.
  // Side sectors are drawn past that edge (the clip trims them); their labels stay inside it.
  const spans = (out: number) => [[out - 160, out - 31.5], [out - 31.5, out + 31.5], [out + 31.5, out + 160]];
  const labelSpan = (out: number, i: number, r: number) => {
    const h = halfSpan(r) - 3;
    return i === 0 ? [out - h, out - 31.5] : i === 1 ? [out - 31.5, out + 31.5] : [out + 31.5, out + h];
  };
  return (
    <svg viewBox="40 20 520 540" className="w-full max-w-[520px] mx-auto" role="img" aria-label="The ProfitX model: Offer, Clients and Delivery with their modules">
      <defs>
        {PILLARS.map(p => <clipPath key={p.key} id={`pxm-${p.key}`}><polygon points={REGIONS[p.key]} /></clipPath>)}
      </defs>
      {PILLARS.map(p => (
        <g key={p.key} clipPath={`url(#pxm-${p.key})`}>
          {(['inner', 'outer'] as const).map(ring => p[ring].map((code, i) => {
            const [a1, a2] = spans(p.out)[i];
            const [r1, r2] = ring === 'inner' ? [R.core, R.mid] : [R.mid, R.edge];
            const later = gate !== null && (MODULE_GATE[code] ?? 1) > gate;
            const id = `pxm-arc-${code}`;
            const title = moduleName(code);
            const mid = (r1 + r2) / 2;
            const [l1, l2] = labelSpan(p.out, i, mid);
            return (
              <g key={code} onClick={() => navigate(`/module/${code}`)} className="cursor-pointer group">
                <title>{`${code} · ${title}${later ? ' (a later gate)' : ''}`}</title>
                <path d={sector(p.cx, p.cy, r1, r2, a1, a2)} fill={ring === 'inner' ? '#dcc8ff' : later ? '#9d5cff' : '#7a2ff0'} stroke="#fff" strokeWidth={3}
                  className="transition-[filter] group-hover:[filter:brightness(1.08)]" />
                <path id={id} d={labelArc(p.cx, p.cy, mid, l1, l2)} fill="none" />
                <text fontSize={title.length > 20 ? 9.5 : title.length > 15 ? 10.5 : 12} fontWeight={600} fill={ring === 'inner' ? '#1b1033' : '#fff'} dy={4}>
                  <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">{title}</textPath>
                </text>
              </g>
            );
          }))}
        </g>
      ))}
      {PILLARS.map(p => <circle key={p.key} cx={p.cx} cy={p.cy} r={R.core} fill="#111" stroke="#fff" strokeWidth={5} />)}
      {PILLARS.map(p => (
        <g key={p.key} pointerEvents="none">
          <text x={p.cx + (p.cx - G.x) * 0.35} y={p.cy + (p.cy - G.y) * 0.35 + 6} textAnchor="middle" fontSize={22} fontWeight={900} fill="#fff">{p.label}</text>
          <text x={p.cx + (p.cx - G.x) * 0.35} y={p.cy + (p.cy - G.y) * 0.35 + 24} textAnchor="middle" fontSize={8} letterSpacing={1.5} fill="#bbb">{p.sub}</text>
        </g>
      ))}
    </svg>
  );
}
