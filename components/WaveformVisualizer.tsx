interface WaveformVisualizerProps {
  active: boolean;
  color?: string;
  barCount?: number;
}

export default function WaveformVisualizer({
  active,
  color = "#00ccee",
  barCount = 20,
}: WaveformVisualizerProps) {
  return (
    <div className="flex items-center justify-center gap-[3px]" style={{ height: 40 }}>
      {Array.from({ length: barCount }).map((_, i) => {
        const delay = (i / barCount) * 1.2;
        const minHeight = 4;
        const maxHeight = 36;
        return (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: 3,
              minHeight,
              height: active ? undefined : minHeight,
              maxHeight,
              background: color,
              boxShadow: active ? `0 0 6px ${color}88` : "none",
              opacity: active ? 0.9 : 0.3,
              animation: active
                ? `waveform ${0.6 + Math.random() * 0.6}s ease-in-out ${delay}s infinite alternate`
                : "none",
              transform: active ? undefined : "scaleY(0.3)",
            }}
          />
        );
      })}
    </div>
  );
}
