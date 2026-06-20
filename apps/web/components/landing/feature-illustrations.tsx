'use client';

import { useEffect, useRef } from 'react';
import anime from 'animejs';

function clamp01(v: number) { return Math.max(0, Math.min(1, v)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

/* ─── 1. Neural Network — Memory feature ──────────────────────────────────── */
const NODES = [
  { x: 50,  y: 80  }, { x: 140, y: 35  }, { x: 230, y: 80  },
  { x: 70,  y: 155 }, { x: 190, y: 150 }, { x: 45,  y: 235 },
  { x: 140, y: 210 }, { x: 245, y: 225 }, { x: 110, y: 112 },
  { x: 180, y: 105 },
];
const EDGES = [[0,8],[8,3],[8,9],[1,9],[9,2],[9,4],[3,6],[6,5],[6,4],[4,2],[4,7],[7,6]];

export function NeuralNetworkSVG({ progress }: { progress: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tlRef  = useRef<anime.AnimeTimelineInstance | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const tl = anime.timeline({ autoplay: false, easing: 'easeOutQuad' });
    tl.add({
      targets: svg.querySelectorAll('[data-node]'),
      opacity: [0, 1], scale: [0, 1],
      duration: 600,
      delay: anime.stagger(55),
    }).add({
      targets: svg.querySelectorAll('[data-edge]'),
      strokeDashoffset: [anime.setDashoffset, 0],
      opacity: [0, 1],
      duration: 500,
      delay: anime.stagger(40),
    }, '-=200').add({
      targets: svg.querySelectorAll('[data-node]'),
      opacity: [1, 0.6, 1],
      scale: [1, 1.12, 1],
      duration: 800,
      delay: anime.stagger(80, { from: 'center' }),
      loop: false,
    }, '-=100');
    tlRef.current = tl;
    return () => { anime.remove(svg); tlRef.current = null; };
  }, []);

  useEffect(() => {
    const tl = tlRef.current;
    if (tl) tl.seek(tl.duration * clamp01(progress));
  }, [progress]);

  return (
    <svg ref={svgRef} viewBox="0 0 290 270" className="w-full h-full" aria-hidden>
      <defs>
        <radialGradient id="nodeGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.6" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {EDGES.map(([a, b], i) => {
        const na = NODES[a as number]!, nb = NODES[b as number]!;
        return (
          <line key={i} data-edge="" x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
            stroke="#7c3aed" strokeWidth="1.5" strokeOpacity="0.5" opacity="0"
          />
        );
      })}
      {NODES.map((n, i) => (
        <circle key={i} data-node="" cx={n.x} cy={n.y} r={i === 9 ? 9 : 6}
          fill="url(#nodeGrad)" filter="url(#glow)" opacity="0"
          style={{ transformOrigin: `${n.x}px ${n.y}px` }}
        />
      ))}
    </svg>
  );
}

/* ─── 2. Shield Scan — AI Verification feature ────────────────────────────── */
const HEX_CENTERS = [
  {x:140,y:100},{x:115,y:125},{x:165,y:125},{x:90,y:150},
  {x:140,y:150},{x:190,y:150},{x:140,y:200},
];

export function ShieldScanSVG({ progress }: { progress: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tlRef  = useRef<anime.AnimeTimelineInstance | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const tl = anime.timeline({ autoplay: false, easing: 'easeOutQuad' });
    tl.add({
      targets: svg.querySelector('[data-shield]'),
      strokeDashoffset: [anime.setDashoffset, 0],
      opacity: [0, 1],
      duration: 800,
    }).add({
      targets: svg.querySelectorAll('[data-hex]'),
      opacity: [0, 0.7], scale: [0, 1],
      duration: 400, delay: anime.stagger(60),
    }, '-=200').add({
      targets: svg.querySelector('[data-scanner]'),
      translateY: [-100, 120],
      opacity: [0, 0.6, 0],
      duration: 700,
    }, '-=100').add({
      targets: svg.querySelector('[data-check]'),
      opacity: [0, 1], scale: [0, 1], rotate: [-20, 0],
      duration: 500, easing: 'easeOutBack',
    }, '-=200');
    tlRef.current = tl;
    return () => { anime.remove(svg); tlRef.current = null; };
  }, []);

  useEffect(() => {
    const tl = tlRef.current;
    if (tl) tl.seek(tl.duration * clamp01(progress));
  }, [progress]);

  return (
    <svg ref={svgRef} viewBox="0 0 280 270" className="w-full h-full" aria-hidden>
      <defs>
        <clipPath id="shieldClip">
          <path d="M140,25 L225,65 L225,148 Q225,210 140,250 Q55,210 55,148 L55,65 Z" />
        </clipPath>
        <filter id="blueGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Shield outline */}
      <path data-shield="" d="M140,25 L225,65 L225,148 Q225,210 140,250 Q55,210 55,148 L55,65 Z"
        fill="none" stroke="#3b82f6" strokeWidth="2.5" opacity="0" filter="url(#blueGlow)"
      />
      {/* Hex cells */}
      {HEX_CENTERS.map((c, i) => {
        const pts = Array.from({length:6},(_,j)=>{
          const a=(j*60-30)*Math.PI/180;
          return `${c.x+Math.cos(a)*18},${c.y+Math.sin(a)*18}`;
        }).join(' ');
        return <polygon key={i} data-hex="" points={pts}
          fill="#1d4ed8" fillOpacity="0.25" stroke="#3b82f6" strokeWidth="1" opacity="0"
          style={{transformOrigin:`${c.x}px ${c.y}px`}}
        />;
      })}
      {/* Scanner */}
      <rect data-scanner="" x="56" y="65" width="169" height="4"
        fill="#60a5fa" opacity="0" clipPath="url(#shieldClip)"
        style={{filter:'blur(2px)'}}
      />
      {/* Checkmark */}
      <g data-check="" opacity="0" style={{transformOrigin:'140px 145px'}}>
        <circle cx="140" cy="145" r="24" fill="#1d4ed8" fillOpacity="0.4" stroke="#3b82f6" strokeWidth="1.5"/>
        <polyline points="128,145 138,155 155,132" fill="none" stroke="#93c5fd" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </svg>
  );
}

/* ─── 3. Constellation — Reputation feature ──────────────────────────────── */
const STAR_ANGLES = [0, 60, 120, 180, 240, 300];

function starPath(cx: number, cy: number, r: number, r2: number, points: number) {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    d += (i === 0 ? 'M' : 'L') + `${x},${y}`;
  }
  return d + 'Z';
}

export function ConstellationSVG({ progress }: { progress: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tlRef  = useRef<anime.AnimeTimelineInstance | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const tl = anime.timeline({ autoplay: false, easing: 'easeOutQuad' });
    tl.add({
      targets: svg.querySelector('[data-center-star]'),
      opacity: [0, 1], scale: [0, 1], rotate: [-45, 0],
      duration: 600, easing: 'easeOutBack',
    }).add({
      targets: svg.querySelectorAll('[data-orb-star]'),
      opacity: [0, 1], scale: [0, 1],
      translateX: (_el: Element, i: number) => {
        const a = (STAR_ANGLES[i] ?? 0) * Math.PI / 180;
        return [Math.cos(a) * 80, 0];
      },
      translateY: (_el: Element, i: number) => {
        const a = (STAR_ANGLES[i] ?? 0) * Math.PI / 180;
        return [Math.sin(a) * 80, 0];
      },
      duration: 600, delay: anime.stagger(70),
    }, '-=200').add({
      targets: svg.querySelectorAll('[data-spoke]'),
      strokeDashoffset: [anime.setDashoffset, 0],
      opacity: [0, 0.5],
      duration: 400, delay: anime.stagger(50),
    }, '-=200').add({
      targets: svg.querySelector('[data-badge]'),
      opacity: [0, 1], scale: [0.6, 1],
      duration: 400, easing: 'easeOutBack',
    }, '-=100');
    tlRef.current = tl;
    return () => { anime.remove(svg); tlRef.current = null; };
  }, []);

  useEffect(() => {
    const tl = tlRef.current;
    if (tl) tl.seek(tl.duration * clamp01(progress));
  }, [progress]);

  const cx = 140, cy = 130, orbR = 82;

  return (
    <svg ref={svgRef} viewBox="0 0 280 270" className="w-full h-full" aria-hidden>
      <defs>
        <filter id="amberGlow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Spokes */}
      {STAR_ANGLES.map((a, i) => {
        const rad = a * Math.PI / 180;
        return <line key={i} data-spoke=""
          x1={cx} y1={cy}
          x2={cx + Math.cos(rad) * orbR} y2={cy + Math.sin(rad) * orbR}
          stroke="#f59e0b" strokeWidth="1" opacity="0"
        />;
      })}
      {/* Orbital ring */}
      <circle cx={cx} cy={cy} r={orbR} fill="none" stroke="#f59e0b" strokeWidth="0.5" strokeOpacity="0.2" strokeDasharray="4 6"/>
      {/* Center star */}
      <path data-center-star="" d={starPath(cx, cy, 28, 12, 6)}
        fill="#f59e0b" fillOpacity="0.9" filter="url(#amberGlow)" opacity="0"
        style={{transformOrigin:`${cx}px ${cy}px`}}
      />
      {/* Orbiting stars */}
      {STAR_ANGLES.map((a, i) => {
        const rad = a * Math.PI / 180;
        const sx = cx + Math.cos(rad) * orbR;
        const sy = cy + Math.sin(rad) * orbR;
        return <path key={i} data-orb-star=""
          d={starPath(sx, sy, 10, 4, 5)}
          fill="#fbbf24" fillOpacity="0.8" opacity="0"
          style={{transformOrigin:`${sx}px ${sy}px`}}
        />;
      })}
      {/* Badge */}
      <g data-badge="" opacity="0" style={{transformOrigin:'140px 225px'}}>
        <rect x="105" y="215" width="70" height="22" rx="11" fill="#92400e" fillOpacity="0.5" stroke="#f59e0b" strokeWidth="1"/>
        <text x="140" y="230" textAnchor="middle" fontSize="9" fill="#fbbf24" fontWeight="700" fontFamily="monospace">+15 REP PROOF</text>
      </g>
    </svg>
  );
}

/* ─── 4. Circuit Board — Milestones feature ──────────────────────────────── */
const CIRCUIT_NODES = [{x:50,y:135},{x:110,y:100},{x:170,y:160},{x:230,y:110}];

export function CircuitBoardSVG({ progress }: { progress: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tlRef  = useRef<anime.AnimeTimelineInstance | null>(null);
  const coinRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const tl = anime.timeline({ autoplay: false, easing: 'easeOutQuad' });
    tl.add({
      targets: svg.querySelectorAll('[data-path]'),
      strokeDashoffset: [anime.setDashoffset, 0],
      opacity: [0, 1],
      duration: 600, delay: anime.stagger(100),
    }).add({
      targets: svg.querySelectorAll('[data-mnode]'),
      opacity: [0, 1], scale: [0, 1],
      fill: ['#064e3b', '#10b981'],
      duration: 350, delay: anime.stagger(130),
    }, '-=200').add({
      targets: coinRef.current,
      translateX: [0, 180],
      translateY: [0, -25],
      opacity: [0, 1, 1, 0.9],
      duration: 800, easing: 'easeInOutSine',
    }, '-=100').add({
      targets: svg.querySelector('[data-final-glow]'),
      opacity: [0, 1], scale: [0.6, 1.2, 1],
      duration: 400, easing: 'easeOutBack',
    }, '-=150');
    tlRef.current = tl;
    return () => { anime.remove(svg); tlRef.current = null; };
  }, []);

  useEffect(() => {
    const tl = tlRef.current;
    if (tl) tl.seek(tl.duration * clamp01(progress));
  }, [progress]);

  return (
    <svg ref={svgRef} viewBox="0 0 280 270" className="w-full h-full" aria-hidden>
      <defs>
        <filter id="greenGlow">
          <feGaussianBlur stdDeviation="3" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Circuit grid background */}
      {[60,100,140,180].map(y => (
        <line key={y} x1="20" y1={y} x2="260" y2={y} stroke="#10b981" strokeWidth="0.3" strokeOpacity="0.12"/>
      ))}
      {[60,110,160,210].map(x => (
        <line key={x} x1={x} y1="60" x2={x} y2="210" stroke="#10b981" strokeWidth="0.3" strokeOpacity="0.12"/>
      ))}
      {/* Main circuit paths between milestone nodes */}
      {CIRCUIT_NODES.slice(0,-1).map((n, i) => {
        const next = CIRCUIT_NODES[i+1]!;
        const mx = (n.x + next.x) / 2;
        return <path key={i} data-path=""
          d={`M${n.x},${n.y} L${mx},${n.y} L${mx},${next.y} L${next.x},${next.y}`}
          fill="none" stroke="#10b981" strokeWidth="2" opacity="0"
          filter="url(#greenGlow)"
        />;
      })}
      {/* Milestone nodes */}
      {CIRCUIT_NODES.map((n, i) => (
        <g key={i} data-mnode="" opacity="0" style={{transformOrigin:`${n.x}px ${n.y}px`}}>
          <circle cx={n.x} cy={n.y} r="14" fill="#064e3b" stroke="#10b981" strokeWidth="2"/>
          <text x={n.x} y={n.y+4} textAnchor="middle" fontSize="9" fill="#6ee7b7" fontWeight="700" fontFamily="monospace">M{i+1}</text>
        </g>
      ))}
      {/* Traveling USDC coin */}
      <g ref={coinRef} opacity="0" style={{transformOrigin:'50px 135px'}}>
        <circle cx="50" cy="135" r="13" fill="#065f46" stroke="#34d399" strokeWidth="2"/>
        <text x="50" y="140" textAnchor="middle" fontSize="9" fill="#a7f3d0" fontWeight="700" fontFamily="monospace">$</text>
      </g>
      {/* Final node glow */}
      <circle data-final-glow="" cx="230" cy="110" r="22" fill="none"
        stroke="#10b981" strokeWidth="2" opacity="0" filter="url(#greenGlow)"
        style={{transformOrigin:'230px 110px'}}
      />
    </svg>
  );
}
