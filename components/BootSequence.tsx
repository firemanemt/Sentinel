import { useEffect, useState, useRef } from "react";

interface BootSequenceProps {
  onComplete: () => void;
}

const BOOT_LINES = [
  "SENTINEL AI — INTELLIGENT ASSISTANT PLATFORM",
  "INITIALIZING SENTINEL v1.0.0 ...",
  "",
  "[ OK ] Loading neural processing core ........... DONE",
  "[ OK ] Calibrating voice synthesis engine ........ DONE",
  "[ OK ] Establishing encrypted uplink ............. DONE",
  "[ OK ] Loading user preference matrix ............ DONE",
  "[ OK ] Connecting to secure cloud network ........ DONE",
  "[ OK ] Initialising HUD overlay systems .......... DONE",
  "[ OK ] Running self-diagnostic ................... PASS",
  "",
  "ALL SYSTEMS NOMINAL",
  "",
  "Hello. How can I assist you today?",
];

export function BootSequence({ onComplete }: BootSequenceProps) {
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLineIdx, setCurrentLineIdx] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"typing" | "fadeout">("typing");
  const [reactorPulse, setReactorPulse] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Type out each line character by character
  useEffect(() => {
    if (phase !== "typing") return;
    if (currentLineIdx >= BOOT_LINES.length) {
      const t = setTimeout(() => setPhase("fadeout"), 600);
      return () => clearTimeout(t);
    }

    const line = BOOT_LINES[currentLineIdx] ?? "";

    if (currentChar < line.length) {
      const delay = line.startsWith("[ OK ]") ? 3 : line === "" ? 0 : 5;
      const t = setTimeout(() => {
        setCurrentChar(c => c + 1);
      }, delay);
      return () => clearTimeout(t);
    } else {
      const pauseMs = line === "" ? 10 : line.includes("DONE") || line.includes("PASS") ? 15 : 30;
      const t = setTimeout(() => {
        setDisplayedLines(prev => [...prev, line]);
        setCurrentLineIdx(i => i + 1);
        setCurrentChar(0);
        const newProgress = Math.round(((currentLineIdx + 1) / BOOT_LINES.length) * 100);
        setProgress(newProgress);
        // Pulse reactor on each OK line
        if (line.includes("[ OK ]")) setReactorPulse(p => p + 1);
      }, pauseMs);
      return () => clearTimeout(t);
    }
  }, [phase, currentLineIdx, currentChar]);

  // Scroll to bottom as lines appear
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedLines, currentChar]);

  // Fade out and call onComplete
  useEffect(() => {
    if (phase !== "fadeout") return;
    const t = setTimeout(onComplete, 400);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const currentLine = BOOT_LINES[currentLineIdx] ?? "";
  const partialLine = currentLine.slice(0, currentChar);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-900 ${phase === "fadeout" ? "opacity-0" : "opacity-100"}`}
      style={{ background: "radial-gradient(ellipse at center, #020d1a 0%, #000305 100%)" }}
    >
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.012) 2px, rgba(0,255,255,0.012) 4px)",
          animation: "boot-scan 8s linear infinite",
        }}
      />

      {/* Arc reactor background rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        {[320, 260, 200, 150, 110].map((size, i) => (
          <div
            key={i}
            className="absolute rounded-full border"
            style={{
              width: size,
              height: size,
              borderColor: `rgba(0,200,255,${0.04 + i * 0.02})`,
              animation: `boot-ring-${i % 2 === 0 ? "cw" : "ccw"} ${18 + i * 4}s linear infinite`,
              boxShadow: i === 4 ? "0 0 20px rgba(0,200,255,0.15), inset 0 0 20px rgba(0,200,255,0.05)" : "none",
            }}
          />
        ))}
        {/* Center arc reactor glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: 60,
            height: 60,
            background: "radial-gradient(circle, rgba(0,220,255,0.25) 0%, rgba(0,100,200,0.1) 50%, transparent 70%)",
            boxShadow: "0 0 30px rgba(0,200,255,0.4), 0 0 60px rgba(0,100,200,0.2)",
            animation: `boot-reactor-pulse 2s ease-in-out infinite`,
            animationDelay: `${reactorPulse * 0.1}s`,
          }}
        />
      </div>

      {/* Corner HUD brackets */}
      {[
        { top: 16, left: 16, deg: 0 },
        { top: 16, right: 16, deg: 90 },
        { bottom: 16, right: 16, deg: 180 },
        { bottom: 16, left: 16, deg: 270 },
      ].map((pos, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            top: (pos as { top?: number }).top,
            bottom: (pos as { bottom?: number }).bottom,
            left: (pos as { left?: number }).left,
            right: (pos as { right?: number }).right,
            width: 24,
            height: 24,
            transform: `rotate(${pos.deg}deg)`,
            borderTop: "2px solid rgba(0,200,255,0.4)",
            borderLeft: "2px solid rgba(0,200,255,0.4)",
          }}
        />
      ))}

      {/* SENTINEL AI header */}
      <div className="relative mb-6 text-center z-10">
        <div
          className="text-xs tracking-[0.5em] mb-1"
          style={{ color: "rgba(0,200,255,0.7)", fontFamily: "monospace", textShadow: "0 0 8px rgba(0,200,255,0.5)" }}
        >
          SENTINEL AI
        </div>
        <div
          className="text-[10px] tracking-[0.7em]"
          style={{ color: "rgba(0,200,255,0.35)", fontFamily: "monospace" }}
        >
          INTELLIGENT ASSISTANT PLATFORM
        </div>
        <div
          className="mt-2 h-px w-48 mx-auto"
          style={{ background: "linear-gradient(90deg, transparent, rgba(0,200,255,0.4), transparent)" }}
        />
      </div>

      {/* Terminal window */}
      <div
        className="relative w-full max-w-2xl mx-4 rounded z-10"
        style={{
          border: "1px solid rgba(0,200,255,0.25)",
          boxShadow: "0 0 40px rgba(0,200,255,0.08), 0 0 80px rgba(0,100,200,0.05), inset 0 0 30px rgba(0,0,0,0.5)",
        }}
      >
        {/* Terminal title bar */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{
            borderBottom: "1px solid rgba(0,200,255,0.15)",
            background: "rgba(0,200,255,0.04)",
          }}
        >
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "rgba(0,200,255,0.5)", boxShadow: "0 0 4px rgba(0,200,255,0.5)" }} />
            <div className="w-2 h-2 rounded-full" style={{ background: "rgba(0,200,255,0.2)" }} />
            <div className="w-2 h-2 rounded-full" style={{ background: "rgba(0,200,255,0.2)" }} />
          </div>
          <span className="text-[10px] tracking-widest ml-1" style={{ color: "rgba(0,200,255,0.45)", fontFamily: "monospace" }}>
            SENTINEL BOOT CONSOLE — v1.0.0
          </span>
          <div className="ml-auto text-[9px]" style={{ color: "rgba(0,200,255,0.25)", fontFamily: "monospace" }}>
            SECURE CHANNEL
          </div>
        </div>

        {/* Terminal body */}
        <div
          ref={containerRef}
          className="p-4 overflow-y-auto"
          style={{
            height: "260px",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: "12px",
            lineHeight: "1.75",
            background: "rgba(0,3,8,0.85)",
          }}
        >
          {displayedLines.map((line, i) => (
            <div key={i} style={{ color: getLineColor(line), whiteSpace: "pre", letterSpacing: "0.03em" }}>
              {line || "\u00A0"}
            </div>
          ))}
          {currentLineIdx < BOOT_LINES.length && (
            <div style={{ color: getLineColor(partialLine), whiteSpace: "pre", letterSpacing: "0.03em" }}>
              {partialLine}
              <span
                style={{
                  display: "inline-block",
                  width: "7px",
                  height: "13px",
                  background: "rgba(0,200,255,0.85)",
                  verticalAlign: "text-bottom",
                  boxShadow: "0 0 6px rgba(0,200,255,0.6)",
                  animation: "blink 0.9s step-end infinite",
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-5 w-full max-w-2xl mx-4 z-10">
        <div className="flex justify-between mb-1.5">
          <span className="text-[10px] tracking-[0.3em]" style={{ color: "rgba(0,200,255,0.35)", fontFamily: "monospace" }}>
            SYSTEM INITIALISATION
          </span>
          <span className="text-[10px]" style={{ color: "rgba(0,200,255,0.6)", fontFamily: "monospace" }}>
            {progress}%
          </span>
        </div>
        <div
          className="h-1 w-full rounded"
          style={{ background: "rgba(0,200,255,0.08)", border: "1px solid rgba(0,200,255,0.15)" }}
        >
          <div
            className="h-full rounded transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, rgba(0,120,180,0.9), rgba(0,220,255,1))",
              boxShadow: "0 0 10px rgba(0,200,255,0.7), 0 0 20px rgba(0,200,255,0.3)",
            }}
          />
        </div>
        {/* Tick marks */}
        <div className="flex justify-between mt-1">
          {[0, 25, 50, 75, 100].map(tick => (
            <span key={tick} className="text-[8px]" style={{ color: "rgba(0,200,255,0.2)", fontFamily: "monospace" }}>
              {tick}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes boot-scan {
          0% { background-position: 0 0; }
          100% { background-position: 0 100vh; }
        }
        @keyframes boot-ring-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes boot-ring-ccw {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes boot-reactor-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}

function getLineColor(line: string): string {
  if (line.includes("[ OK ]")) return "rgba(0,220,100,0.9)";
  if (line.includes("DONE") || line.includes("PASS")) return "rgba(0,220,100,0.9)";
  if (line.includes("FAIL") || line.includes("ERROR")) return "rgba(255,60,60,0.9)";
  if (line.includes("SENTINEL AI") || line.includes("SENTINEL v")) return "rgba(0,220,255,1)";
  if (line.includes("ALL SYSTEMS NOMINAL")) return "rgba(0,220,255,1)";
  if (line.includes("Good day")) return "rgba(200,230,255,0.95)";
  return "rgba(0,200,255,0.75)";
}
