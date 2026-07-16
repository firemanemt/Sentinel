import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  speed: number;
  opacity: number;
  size: number;
  char: string;
  color: string;
}

const HUD_CHARS = "01アイウカキクサシスタチ▲▼◆░▒─│┼╔╗ABCDEF0123456789";

function randomChar() {
  return HUD_CHARS[Math.floor(Math.random() * HUD_CHARS.length)] ?? "0";
}

interface HudParticlesProps {
  state: "idle" | "listening" | "thinking" | "speaking";
  side: "left" | "right";
  width?: number;
  height?: number;
  intensity?: number;
  color?: string;
  accent?: string;
}

const TARGET_FPS = 20;
const FRAME_MS = 1000 / TARGET_FPS;

export default function HudParticles({ state, side, width = 40, height = 400, intensity = 1, color = "#00ccee", accent = "#4488ff" }: HudParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);
  const stateRef = useRef(state);
  const intensityRef = useRef(intensity);
  const colorRef = useRef(color);
  const accentRef = useRef(accent);
  const lastFrameRef = useRef(0);
  const pausedRef = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { intensityRef.current = intensity; }, [intensity]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { accentRef.current = accent; }, [accent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    // Page Visibility API
    const handleVisibility = () => { pausedRef.current = document.hidden; };
    document.addEventListener("visibilitychange", handleVisibility);

    const count = Math.min(3, Math.floor(width / 12));
    particlesRef.current = Array.from({ length: count }, (_, i) => ({
      x: (i / count) * width + Math.random() * (width / count),
      y: Math.random() * height,
      speed: 0.4 + Math.random() * 0.6,
      opacity: 0.12 + Math.random() * 0.3,
      size: 8 + Math.random() * 3,
      char: randomChar(),
      color: Math.random() > 0.85 ? accentRef.current : colorRef.current,
    }));

    const draw = (timestamp: number) => {
      animRef.current = requestAnimationFrame(draw);
      if (pausedRef.current) return;
      if (timestamp - lastFrameRef.current < FRAME_MS) return;
      lastFrameRef.current = timestamp;

      const s = stateRef.current;
      const intens = intensityRef.current;
      const speedMult = s === "thinking" ? 2.5 : s === "listening" ? 1.6 : s === "speaking" ? 2.0 : 1;
      const opacityMult = (s === "thinking" ? 1.6 : s === "speaking" ? 1.4 : 1) * intens;

      ctx.clearRect(0, 0, width, height);

      for (const p of particlesRef.current) {
        p.y -= p.speed * speedMult * (TARGET_FPS / 60) * 3;
        if (p.y < -20) {
          p.y = height + 10;
          p.x = Math.random() * width;
          p.char = randomChar();
          p.opacity = 0.12 + Math.random() * 0.3;
          p.speed = 0.4 + Math.random() * 0.6;
        }
        if (Math.random() < 0.05) p.char = randomChar();

        ctx.globalAlpha = Math.min(1, p.opacity * opacityMult);
        ctx.fillStyle = p.color;
        ctx.font = `${p.size}px monospace`;
        ctx.fillText(p.char, p.x, p.y);
      }

      // Faint edge line
      ctx.globalAlpha = 0.12 * intens;
      const lineX = side === "left" ? width - 1 : 0;
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "transparent");
      gradient.addColorStop(0.3, colorRef.current);
      gradient.addColorStop(0.7, colorRef.current);
      gradient.addColorStop(1, "transparent");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(lineX, 0); ctx.lineTo(lineX, height); ctx.stroke();
      ctx.globalAlpha = 1;
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [width, height, side]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        [side]: 0,
        width,
        height: "100%",
        pointerEvents: "none",
        opacity: 0.55,
      }}
    />
  );
}
