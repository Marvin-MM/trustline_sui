'use client';

import { useState, useRef, useCallback } from 'react';
import { Wallet, LayoutDashboard, GitBranch, DollarSign, Database, ShieldCheck, Send, RotateCcw } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface FlowNode {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  color: string;
  x: number;
  y: number;
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_W = 190;
const NODE_H = 72;
const CANVAS_W = 820;
const CANVAS_H = 780;

const INITIAL_NODES: FlowNode[] = [
  { id: 'login',      label: 'Wallet Login',            sublabel: 'Sign-In With Sui (SIWS)',   icon: Wallet,          color: 'hsl(259 80% 65%)', x: 315, y: 20  },
  { id: 'inbox',      label: 'Personal Inbox',           sublabel: 'Recipient dashboard',       icon: LayoutDashboard, color: 'hsl(220 70% 60%)', x: 60,  y: 160 },
  { id: 'workspace',  label: 'Workspace',                sublabel: 'Payer / Operator area',     icon: GitBranch,       color: 'hsl(200 70% 55%)', x: 575, y: 160 },
  { id: 'create',     label: 'Create Relationship',      sublabel: 'Define terms & recipient',  icon: GitBranch,       color: 'hsl(259 80% 65%)', x: 575, y: 300 },
  { id: 'milestones', label: 'Define USDC Milestones',   sublabel: 'Set amounts & conditions',  icon: DollarSign,      color: 'hsl(43 95% 55%)',  x: 575, y: 440 },
  { id: 'fund',       label: 'Fund on Sui',              sublabel: 'Lock USDC in contract',     icon: DollarSign,      color: 'hsl(145 65% 45%)', x: 315, y: 570 },
  { id: 'walrus',     label: 'Submit Proof → Walrus',    sublabel: 'Recipient uploads evidence', icon: Database,       color: 'hsl(259 80% 65%)', x: 60,  y: 680 },
  { id: 'verify',     label: 'AI Verification',          sublabel: 'Gemini checks evidence',    icon: ShieldCheck,     color: 'hsl(200 70% 60%)', x: 315, y: 680 },
  { id: 'release',    label: 'Approve & Release',        sublabel: 'Mint attestation on Sui',   icon: Send,            color: 'hsl(145 65% 45%)', x: 575, y: 680 },
];

const EDGES: FlowEdge[] = [
  { from: 'login',      to: 'inbox',      label: 'Recipient' },
  { from: 'login',      to: 'workspace',  label: 'Payer / Operator' },
  { from: 'workspace',  to: 'create' },
  { from: 'create',     to: 'milestones' },
  { from: 'milestones', to: 'fund' },
  { from: 'fund',       to: 'walrus',     label: 'Recipient submits' },
  { from: 'walrus',     to: 'verify' },
  { from: 'verify',     to: 'release' },
];

// ─── Edge helpers ─────────────────────────────────────────────────────────────

function getEdgePath(a: FlowNode, b: FlowNode): string {
  const ax = a.x + NODE_W / 2;
  const ay = a.y + NODE_H;
  const bx = b.x + NODE_W / 2;
  const by = b.y;
  const dy = Math.abs(by - ay);
  const cp1y = ay + dy * 0.45;
  const cp2y = by - dy * 0.45;
  return `M ${ax} ${ay} C ${ax} ${cp1y} ${bx} ${cp2y} ${bx} ${by}`;
}

function edgeMidpoint(a: FlowNode, b: FlowNode) {
  const ax = a.x + NODE_W / 2;
  const ay = a.y + NODE_H;
  const bx = b.x + NODE_W / 2;
  const by = b.y;
  return { x: (ax + bx) / 2, y: (ay + by) / 2 - 8 };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FlowDiagram() {
  const [nodes, setNodes] = useState<FlowNode[]>(INITIAL_NODES);
  const [dragging, setDragging] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  // Stores the offset from pointer down to the node's top-left corner
  const dragOffset = useRef<{ ox: number; oy: number }>({ ox: 0, oy: 0 });

  const nodeMap: Record<string, FlowNode> = {};
  for (const n of nodes) nodeMap[n.id] = n;

  // ── Pointer handlers ─────────────────────────────────────────────────────

  const onNodePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Capture so move/up fire even if pointer leaves the node div
      e.currentTarget.setPointerCapture(e.pointerId);

      const rect = canvas.getBoundingClientRect();
      const node = nodes.find((n) => n.id === id);
      if (!node) return;

      // Offset = pointer position relative to canvas  minus  node top-left
      dragOffset.current = {
        ox: e.clientX - rect.left - node.x,
        oy: e.clientY - rect.top  - node.y,
      };
      setDragging(id);
    },
    [nodes]
  );

  const onCanvasPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const rawX = e.clientX - rect.left - dragOffset.current.ox;
      const rawY = e.clientY - rect.top  - dragOffset.current.oy;

      // Clamp inside canvas bounds
      const x = Math.max(0, Math.min(rawX, CANVAS_W - NODE_W));
      const y = Math.max(0, Math.min(rawY, CANVAS_H - NODE_H));

      setNodes((prev) =>
        prev.map((n) => (n.id === dragging ? { ...n, x, y } : n))
      );
    },
    [dragging]
  );

  const onCanvasPointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const handleReset = () => {
    setNodes(INITIAL_NODES);
    setDragging(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border border-border bg-card/50 shadow-sm overflow-hidden select-none">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            TrustLine — Payment Relationship Flow
          </span>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      {/* Canvas wrapper — fixed-height, scrollable */}
      <div className="overflow-auto">
        {/* Pointer events live on this wrapper div so move/up are always captured */}
        <div
          ref={canvasRef}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerLeave={onCanvasPointerUp}
          className="relative"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            cursor: dragging ? 'grabbing' : 'default',
          }}
        >
          {/* Dot-grid background */}
          <svg
            className="pointer-events-none absolute inset-0 opacity-25 dark:opacity-15"
            width={CANVAS_W}
            height={CANVAS_H}
          >
            <defs>
              <pattern id="fd-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="1.5" fill="hsl(var(--muted-foreground))" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#fd-dots)" />
          </svg>

          {/* SVG edges — always redrawn from state so they follow nodes */}
          <svg
            className="pointer-events-none absolute inset-0"
            width={CANVAS_W}
            height={CANVAS_H}
            overflow="visible"
          >
            <defs>
              <marker
                id="fd-arrow"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--muted-foreground))" opacity="0.5" />
              </marker>
            </defs>

            {EDGES.map((edge) => {
              const from = nodeMap[edge.from];
              const to   = nodeMap[edge.to];
              if (!from || !to) return null;
              const mid = edgeMidpoint(from, to);
              return (
                <g key={`${edge.from}→${edge.to}`}>
                  <path
                    d={getEdgePath(from, to)}
                    fill="none"
                    stroke="hsl(var(--border))"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    markerEnd="url(#fd-arrow)"
                  />
                  {edge.label && (
                    <text
                      x={mid.x}
                      y={mid.y}
                      textAnchor="middle"
                      fontSize={9}
                      fontWeight={500}
                      fill="hsl(var(--muted-foreground))"
                      fontFamily="inherit"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const Icon = node.icon;
            const isActive = dragging === node.id;
            return (
              <div
                key={node.id}
                onPointerDown={(e) => onNodePointerDown(e, node.id)}
                className={`absolute touch-none rounded-2xl border bg-card flex items-center gap-3 px-3.5 py-3 transition-shadow ${
                  isActive
                    ? 'shadow-2xl border-primary/40 ring-2 ring-primary/20 z-50'
                    : 'shadow-sm border-border hover:border-primary/30 hover:shadow-md cursor-grab z-10'
                }`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: NODE_W,
                  height: NODE_H,
                  borderTop: `3px solid ${node.color}`,
                  // Disable CSS transition during drag for zero-latency
                  transition: isActive ? 'none' : 'box-shadow 150ms, border-color 150ms',
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${node.color}22` }}
                >
                  <Icon className="h-[18px] w-[18px]" style={{ color: node.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-tight truncate">
                    {node.label}
                  </p>
                  {node.sublabel && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {node.sublabel}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/60 bg-muted/10 px-5 py-2 text-center">
        <p className="text-[10px] text-muted-foreground">
          Drag any node to rearrange · Refreshing the page resets the layout
        </p>
      </div>
    </div>
  );
}
