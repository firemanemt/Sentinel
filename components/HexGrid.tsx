import { useEffect, useRef } from "react";

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r || 0, g || 0, b || 0];
}

interface HexGridProps {
  state: "idle" | "listening" | "thinking" | "speaking";
  intensity?: number;
  color?: string; // hex like "#00ccee"
}

export default function HexGrid({ state, intensity = 1, color = "#00ccee" }: HexGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const intensityRef = useRef(intensity);
  const colorRef = useRef(color);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const pausedRef = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { intensityRef.current = intensity; }, [intensity]);
  useEffect(() => { colorRef.current = color; }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Page Visibility API — pause RAF when tab is hidden
    const handleVisibility = () => {
      pausedRef.current = document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const HEX_SIZE = 36;
    const HEX_H = HEX_SIZE * Math.sqrt(3);
    const HEX_W = HEX_SIZE * 2;
    const TARGET_FPS = 20;
    const FRAME_MS = 1000 / TARGET_FPS;

    function hexPath(cx: number, cy: number, r: number) {
      ctx!.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
      }
      ctx!.closePath();
    }

    const draw = (timestamp: number) => {
      animRef.current = requestAnimationFrame(draw);

      // Skip drawing when tab is hidden
      if (pausedRef.current) return;

      // Throttle to TARGET_FPS
      if (timestamp - lastFrameRef.current < FRAME_MS) return;
      lastFrameRef.current = timestamp;

      const s = stateRef.current;
      const intens = intensityRef.current;
      timeRef.current += 0.016 * (TARGET_FPS / 60) * 3;
      const t = timeRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Scale alpha by intensity
      const baseAlpha = (s === "idle" ? 0.016 : s === "listening" ? 0.03 : s === "thinking" ? 0.045 : 0.038) * intens;
      const pulseAlpha = (s === "idle" ? 0.005 : s === "thinking" ? 0.02 : 0.012) * intens;

      const cols = Math.ceil(canvas.width / (HEX_W * 0.75)) + 2;
      const rows = Math.ceil(canvas.height / HEX_H) + 2;

      ctx.lineWidth = 0.5;

      for (let col = -1; col < cols; col++) {
        for (let row = -1; row < rows; row++) {
          const cx = col * HEX_W * 0.75;
          const cy = row * HEX_H + (col % 2 === 0 ? 0 : HEX_H / 2);

          const dx = cx - canvas.width / 2;
          const dy = cy - canvas.height / 2;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const wave = Math.sin(t * 0.8 - dist * 0.01) * 0.5 + 0.5;
          const alpha = baseAlpha + pulseAlpha * wave;

          const [r2, g2, b2] = hexToRgb(colorRef.current);
          ctx.strokeStyle = `rgba(${r2}, ${g2}, ${b2}, ${alpha})`;
          hexPath(cx, cy, HEX_SIZE - 1);
          ctx.stroke();

          if (s === "thinking" && Math.sin(t * 2 + col * 7.3 + row * 5.1) > 0.96) {
            ctx.fillStyle = `rgba(${r2}, ${g2}, ${b2}, ${0.08 * intens})`;
            hexPath(cx, cy, HEX_SIZE - 1);
            ctx.fill();
          }
        }
      }
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  );
}
