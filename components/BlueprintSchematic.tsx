import { useEffect, useRef } from "react";

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r || 0, g || 0, b || 0];
}

type DiagramType = "radar" | "oscilloscope" | "barchart" | "grid" | "rings" | "spectrum";

interface BlueprintSchematicProps {
  type: DiagramType;
  width?: number;
  height?: number;
  state?: "idle" | "listening" | "thinking" | "speaking";
  label?: string;
  sublabel?: string;
  color?: string;
}

const TARGET_FPS_CONST = 24;
const TARGET_FPS = TARGET_FPS_CONST;
const FRAME_MS = 1000 / TARGET_FPS;

export default function BlueprintSchematic({
  type,
  width = 180,
  height = 120,
  state = "idle",
  label,
  sublabel,
  color = "#00ccee",
}: BlueprintSchematicProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const colorRef = useRef(color);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);
  const lastFrameRef = useRef(0);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { colorRef.current = color; }, [color]);

  // Dynamic colour helpers that read from colorRef
  const C_DIM = (a: number) => { const [r,g,b] = hexToRgb(colorRef.current); return `rgba(${r},${g},${b},${a})`; };
  const C_BRIGHT = (a: number) => { const [r,g,b] = hexToRgb(colorRef.current); return `rgba(${Math.min(255,r+36)},${Math.min(255,g+36)},${Math.min(255,b+17)},${a})`; };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    canvas.width = width;
    canvas.height = height;

    const spd = () => {
      switch (stateRef.current) {
        case "thinking": return 2.2;
        case "speaking": return 1.6;
        case "listening": return 1.3;
        default: return 1.0;
      }
    };

    // ── Radar ────────────────────────────────────────────────────────────────
    const drawRadar = (t: number) => {
      const cx = width / 2, cy = height / 2;
      const r = Math.min(cx, cy) - 4;

      // Rings
      ctx.lineWidth = 0.5;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (r / 4) * i, 0, Math.PI * 2);
        ctx.strokeStyle = C_DIM(0.14 + i * 0.03);
        ctx.stroke();
      }
      // Cross-hairs
      ctx.strokeStyle = C_DIM(0.12);
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();

      // Sweep
      const angle = (t * spd() * 0.6) % (Math.PI * 2);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const sweep = ctx.createLinearGradient(0, 0, r, 0);
      sweep.addColorStop(0, C_BRIGHT(0.5));
      sweep.addColorStop(1, C_DIM(0));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, -0.25, 0);
      ctx.closePath();
      ctx.fillStyle = sweep;
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r, 0);
      ctx.strokeStyle = C_BRIGHT(0.7); ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();

      // Blips
      const blips = [{ a: 0.8, d: 0.55 }, { a: 2.1, d: 0.75 }, { a: 3.7, d: 0.4 }, { a: 5.0, d: 0.65 }];
      for (const b of blips) {
        const diff = ((angle - b.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const fade = diff < 0.3 ? 1 : Math.max(0, 1 - (diff / (Math.PI * 2)) * 3);
        if (fade > 0.02) {
          const bx = cx + Math.cos(b.a) * r * b.d;
          const by = cy + Math.sin(b.a) * r * b.d;
          ctx.beginPath(); ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = C_BRIGHT(fade * 0.85); ctx.fill();
        }
      }
      // Center
      ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fillStyle = C_BRIGHT(0.9); ctx.fill();
    };

    // ── Oscilloscope ─────────────────────────────────────────────────────────
    const drawOscilloscope = (t: number) => {
      const s = spd();
      // Grid
      ctx.lineWidth = 0.4;
      ctx.strokeStyle = C_DIM(0.07);
      for (let i = 0; i <= 4; i++) { const y = (height / 4) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
      for (let i = 0; i <= 6; i++) { const x = (width / 6) * i; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }

      const amp = stateRef.current === "idle" ? 0.16 : stateRef.current === "listening" ? 0.3 : stateRef.current === "thinking" ? 0.26 : 0.36;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 2) { // step by 2 for speed
        const phase = (x / width) * Math.PI * 8 - t * s * 2;
        const y = height / 2 + Math.sin(phase) * height * amp + Math.sin(phase * 2.3 + t * s) * height * amp * 0.25;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = C_BRIGHT(0.65); ctx.lineWidth = 1.2; ctx.stroke();
    };

    // ── Bar chart ────────────────────────────────────────────────────────────
    const drawBarChart = (t: number) => {
      const s = spd();
      const bars = 10; // reduced from 12
      const barW = (width - 8) / bars - 2;
      const maxH = height - 16;

      ctx.strokeStyle = C_DIM(0.22); ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(4, height - 8); ctx.lineTo(width - 4, height - 8); ctx.stroke();

      for (let i = 0; i < bars; i++) {
        const phase = t * s * 0.8 + i * 0.7;
        const h = maxH * (0.2 + 0.6 * (Math.sin(phase) * 0.5 + 0.5) + 0.2 * (Math.sin(phase * 2.1) * 0.5 + 0.5));
        const x = 6 + i * (barW + 2);
        const y = height - 8 - h;
        const grad = ctx.createLinearGradient(x, y, x, height - 8);
        grad.addColorStop(0, C_BRIGHT(0.65));
        grad.addColorStop(1, C_DIM(0.12));
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, h);
        ctx.fillStyle = C_BRIGHT(0.85);
        ctx.fillRect(x, y, barW, 1.5);
      }
    };

    // ── Perspective grid ─────────────────────────────────────────────────────
    const drawGrid = (t: number) => {
      const s = spd();
      const horizon = height * 0.35;
      const vp = { x: width / 2, y: horizon };
      const cols = 8, rows = 6; // reduced

      ctx.lineWidth = 0.5;
      for (let i = 0; i <= cols; i++) {
        const bx = (width / cols) * i;
        ctx.beginPath(); ctx.moveTo(vp.x, vp.y); ctx.lineTo(bx, height);
        ctx.strokeStyle = C_DIM(0.1); ctx.stroke();
      }

      const scroll = (t * s * 0.4) % (height / rows);
      for (let i = 0; i <= rows + 1; i++) {
        const progress = ((i * (height / rows) + scroll) % height) / height;
        const y = horizon + (height - horizon) * progress;
        const xLeft = vp.x - vp.x * progress;
        const xRight = vp.x + (width - vp.x) * progress;
        ctx.beginPath(); ctx.moveTo(xLeft, y); ctx.lineTo(xRight, y);
        ctx.strokeStyle = C_DIM(0.07 + progress * 0.1); ctx.stroke();
      }

      ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(width, horizon);
      ctx.strokeStyle = C_DIM(0.28); ctx.lineWidth = 0.8; ctx.stroke();
      ctx.beginPath(); ctx.arc(vp.x, vp.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = C_BRIGHT(0.75); ctx.fill();
    };

    // ── Rings ────────────────────────────────────────────────────────────────
    const drawRings = (t: number) => {
      const s = spd();
      const cx = width / 2, cy = height / 2;
      const maxR = Math.min(cx, cy) - 4;

      const rings = [
        { r: maxR * 0.93, speed: 0.08, dash: [6, 4], alpha: 0.22 },
        { r: maxR * 0.75, speed: -0.15, dash: [3, 6], alpha: 0.32 },
        { r: maxR * 0.57, speed: 0.24, dash: [8, 3], alpha: 0.38 },
        { r: maxR * 0.38, speed: -0.36, dash: [4, 4], alpha: 0.42 },
        { r: maxR * 0.22, speed: 0.55, dash: [2, 3], alpha: 0.48 },
      ];

      for (const ring of rings) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * s * ring.speed);
        ctx.beginPath(); ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
        ctx.setLineDash(ring.dash);
        ctx.strokeStyle = C_DIM(ring.alpha); ctx.lineWidth = 0.8; ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Tick marks (only major)
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + t * s * 0.08;
        const r1 = maxR * 0.93, r2 = r1 - 6;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
        ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
        ctx.strokeStyle = C_DIM(0.5); ctx.lineWidth = 0.8; ctx.stroke();
      }

      // Center
      const pulse = Math.sin(t * s * 2) * 0.3 + 0.7;
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = C_BRIGHT(pulse); ctx.fill();
    };

    // ── Main loop ────────────────────────────────────────────────────────────
    const loop = (timestamp: number) => {
      animRef.current = requestAnimationFrame(loop);
      if (timestamp - lastFrameRef.current < FRAME_MS) return;
      lastFrameRef.current = timestamp;

      tRef.current += 0.016 * (TARGET_FPS / 60) * (60 / TARGET_FPS);
      const t = tRef.current;

      ctx.clearRect(0, 0, width, height);

      switch (type) {
        case "radar": drawRadar(t); break;
        case "oscilloscope": drawOscilloscope(t); break;
        case "barchart": drawBarChart(t); break;
        case "grid": drawGrid(t); break;
        case "rings": drawRings(t); break;
        default: break;
      }
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, width, height]);

  return (
    <div className="relative flex flex-col" style={{ width, flexShrink: 0 }}>
      <div
        className="relative"
        style={{ border: `1px solid ${C_DIM(0.18)}`, background: "rgba(0,15,25,0.35)", padding: "2px" }}
      >
        <span className="absolute top-0 left-0 w-2 h-2" style={{ borderTop: `1px solid ${C_DIM(0.65)}`, borderLeft: `1px solid ${C_DIM(0.65)}` }} />
        <span className="absolute top-0 right-0 w-2 h-2" style={{ borderTop: `1px solid ${C_DIM(0.65)}`, borderRight: `1px solid ${C_DIM(0.65)}` }} />
        <span className="absolute bottom-0 left-0 w-2 h-2" style={{ borderBottom: `1px solid ${C_DIM(0.65)}`, borderLeft: `1px solid ${C_DIM(0.65)}` }} />
        <span className="absolute bottom-0 right-0 w-2 h-2" style={{ borderBottom: `1px solid ${C_DIM(0.65)}`, borderRight: `1px solid ${C_DIM(0.65)}` }} />
        <canvas ref={canvasRef} style={{ display: "block" }} />
      </div>
      {(label || sublabel) && (
        <div className="flex justify-between items-baseline mt-1 px-0.5">
          {label && <span style={{ color: C_DIM(0.45), fontSize: "8px", fontFamily: "monospace", letterSpacing: "0.1em" }}>{label}</span>}
          {sublabel && <span style={{ color: C_DIM(0.28), fontSize: "7px", fontFamily: "monospace" }}>{sublabel}</span>}
        </div>
      )}
    </div>
  );
}
