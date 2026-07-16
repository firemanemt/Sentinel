interface ArcReactorProps {
  state: "idle" | "listening" | "thinking" | "speaking";
  size?: number;
  themeColor?: string; // hex, e.g. "#00ccee"
}

export default function ArcReactor({ state, size = 180, themeColor = "#00ccee" }: ArcReactorProps) {
  // Derive state-specific brightness from the theme colour
  const glowColor = themeColor;

  const glowIntensity =
    state === "idle"
      ? `0 0 20px ${themeColor}44, 0 0 40px ${themeColor}22`
      : state === "listening"
        ? `0 0 30px ${themeColor}88, 0 0 60px ${themeColor}44, 0 0 100px ${themeColor}22`
        : state === "thinking"
          ? `0 0 25px ${themeColor}66, 0 0 50px ${themeColor}33, 0 0 80px ${themeColor}11`
          : `0 0 40px ${themeColor}aa, 0 0 80px ${themeColor}55, 0 0 140px ${themeColor}22`;

  // Speed multipliers per state
  const spinSpeed = state === "thinking" ? "4s" : state === "speaking" ? "6s" : state === "listening" ? "8s" : "12s";
  const spinReverseSpeed = state === "thinking" ? "2.5s" : state === "speaking" ? "4s" : state === "listening" ? "5s" : "6s";
  const innerSpinSpeed = state === "thinking" ? "6s" : state === "speaking" ? "10s" : "20s";
  const orbitSpeed = state === "thinking" ? "1.5s" : state === "speaking" ? "2s" : state === "listening" ? "3s" : "5s";

  const scale = size / 180;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Outer glow ring */}
      <div
        className="absolute rounded-full transition-all duration-700"
        style={{
          width: size,
          height: size,
          boxShadow: glowIntensity,
          animation: state !== "idle"
            ? "arc-glow-pulse 1.5s ease-in-out infinite"
            : "arc-glow-pulse 3s ease-in-out infinite",
        }}
      />

      {/* Outer orbit ring — extra decorative ring outside the main SVG */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size * 1.18,
          height: size * 1.18,
          border: `1px solid ${glowColor}22`,
          boxShadow: `0 0 8px ${glowColor}22`,
          animation: `arc-spin ${orbitSpeed} linear infinite`,
          transformOrigin: "center",
        }}
      >
        {/* Orbit dot */}
        <div
          className="absolute rounded-full"
          style={{
            width: 5 * scale,
            height: 5 * scale,
            background: glowColor,
            boxShadow: `0 0 6px ${glowColor}`,
            top: "50%",
            left: -2.5 * scale,
            transform: "translateY(-50%)",
          }}
        />
      </div>

      {/* Second orbit ring — counter-rotating */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size * 1.1,
          height: size * 1.1,
          border: `1px dashed ${glowColor}18`,
          animation: `arc-spin-reverse ${orbitSpeed} linear infinite`,
          transformOrigin: "center",
        }}
      >
        {/* Counter-orbit dot */}
        <div
          className="absolute rounded-full"
          style={{
            width: 3 * scale,
            height: 3 * scale,
            background: glowColor,
            boxShadow: `0 0 4px ${glowColor}`,
            top: -1.5 * scale,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        />
      </div>

      {/* SVG Arc Reactor */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 180 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        {/* Outer ring */}
        <circle cx="90" cy="90" r="86" stroke={glowColor} strokeWidth="1.5" strokeOpacity="0.4" fill="none" />
        <circle cx="90" cy="90" r="82" stroke={glowColor} strokeWidth="0.5" strokeOpacity="0.3" fill="none" />

        {/* Outer rotating ring with tick marks */}
        <g style={{ transformOrigin: "90px 90px", animation: `arc-spin ${spinSpeed} linear infinite` }}>
          {Array.from({ length: 32 }).map((_, i) => {
            const angle = (i * 360) / 32;
            const rad = (angle * Math.PI) / 180;
            const isMajor = i % 4 === 0;
            const x1 = 90 + 76 * Math.cos(rad);
            const y1 = 90 + 76 * Math.sin(rad);
            const x2 = 90 + (isMajor ? 84 : 81) * Math.cos(rad);
            const y2 = 90 + (isMajor ? 84 : 81) * Math.sin(rad);
            return (
              <line
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={glowColor}
                strokeWidth={isMajor ? "2" : "0.8"}
                strokeOpacity={isMajor ? "0.9" : "0.4"}
              />
            );
          })}
        </g>

        {/* Middle ring - counter rotating */}
        <g style={{ transformOrigin: "90px 90px", animation: `arc-spin-reverse ${spinReverseSpeed} linear infinite` }}>
          <circle cx="90" cy="90" r="62" stroke={glowColor} strokeWidth="1" strokeOpacity="0.5" fill="none" strokeDasharray="8 4" />
          {/* Dashes on middle ring */}
          {state !== "idle" && Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * 360) / 8;
            const rad = (angle * Math.PI) / 180;
            return (
              <circle
                key={i}
                cx={90 + 62 * Math.cos(rad)}
                cy={90 + 62 * Math.sin(rad)}
                r="1.5"
                fill={glowColor}
                fillOpacity={i % 2 === 0 ? "0.8" : "0.3"}
              />
            );
          })}
        </g>

        {/* Inner structural ring */}
        <g style={{ transformOrigin: "90px 90px", animation: `arc-spin ${innerSpinSpeed} linear infinite` }}>
          <circle cx="90" cy="90" r="52" stroke={glowColor} strokeWidth="1.5" strokeOpacity="0.6" fill="none" strokeDasharray="16 8 4 8" />
        </g>

        {/* Hexagonal inner structure */}
        <polygon
          points="90,58 116,74 116,106 90,122 64,106 64,74"
          stroke={glowColor}
          strokeWidth="1.5"
          strokeOpacity="0.7"
          fill={`${glowColor}08`}
        />

        {/* Inner hex lines */}
        <line x1="90" y1="58" x2="90" y2="122" stroke={glowColor} strokeWidth="0.5" strokeOpacity="0.3" />
        <line x1="64" y1="74" x2="116" y2="106" stroke={glowColor} strokeWidth="0.5" strokeOpacity="0.3" />
        <line x1="116" y1="74" x2="64" y2="106" stroke={glowColor} strokeWidth="0.5" strokeOpacity="0.3" />

        {/* Core glow */}
        <circle cx="90" cy="90" r="28" fill={`${glowColor}15`} stroke={glowColor} strokeWidth="2" strokeOpacity="0.8" />
        <circle cx="90" cy="90" r="20" fill={`${glowColor}25`} stroke={glowColor} strokeWidth="1" strokeOpacity="0.6" />

        {/* Core center — pulses faster when active */}
        <circle
          cx="90" cy="90" r="12"
          fill={`${glowColor}40`}
          style={{
            animation: state === "idle"
              ? "arc-pulse 2.5s ease-in-out infinite"
              : state === "thinking"
                ? "arc-pulse 0.6s ease-in-out infinite"
                : state === "speaking"
                  ? "arc-pulse 0.9s ease-in-out infinite"
                  : "arc-pulse 1.2s ease-in-out infinite",
            transformOrigin: "90px 90px",
          }}
        />
        <circle cx="90" cy="90" r="6" fill={glowColor} fillOpacity="0.9" />
        <circle cx="90" cy="90" r="3" fill="white" fillOpacity="0.95" />

        {/* Radial spokes */}
        {[0, 60, 120, 180, 240, 300].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          return (
            <line
              key={angle}
              x1={90 + 12 * Math.cos(rad)} y1={90 + 12 * Math.sin(rad)}
              x2={90 + 26 * Math.cos(rad)} y2={90 + 26 * Math.sin(rad)}
              stroke={glowColor}
              strokeWidth="1.5"
              strokeOpacity="0.8"
            />
          );
        })}

        {/* Listening: three pulsing dots on outer ring */}
        {state === "listening" && (
          <g>
            {[0, 120, 240].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              return (
                <circle
                  key={i}
                  cx={90 + 68 * Math.cos(rad)}
                  cy={90 + 68 * Math.sin(rad)}
                  r="3"
                  fill={glowColor}
                  style={{ animation: `thinking-dots 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              );
            })}
          </g>
        )}

        {/* Thinking: five rapid pulsing dots */}
        {state === "thinking" && (
          <g>
            {[0, 72, 144, 216, 288].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              return (
                <circle
                  key={i}
                  cx={90 + 68 * Math.cos(rad)}
                  cy={90 + 68 * Math.sin(rad)}
                  r="2.5"
                  fill={themeColor}
                  style={{ animation: `thinking-dots 0.5s ease-in-out ${i * 0.1}s infinite` }}
                />
              );
            })}
          </g>
        )}

        {/* Speaking: energy arcs radiating outward */}
        {state === "speaking" && (
          <g>
            {[0, 72, 144, 216, 288].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              return (
                <circle
                  key={i}
                  cx={90 + 68 * Math.cos(rad)}
                  cy={90 + 68 * Math.sin(rad)}
                  r="2.5"
                  fill={glowColor}
                  style={{ animation: `thinking-dots 0.8s ease-in-out ${i * 0.15}s infinite` }}
                />
              );
            })}
            {/* Extra arcs for speaking */}
            {[36, 108, 180, 252, 324].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              return (
                <circle
                  key={`arc-${i}`}
                  cx={90 + 74 * Math.cos(rad)}
                  cy={90 + 74 * Math.sin(rad)}
                  r="1.5"
                  fill={glowColor}
                  fillOpacity="0.5"
                  style={{ animation: `thinking-dots 0.8s ease-in-out ${i * 0.15 + 0.4}s infinite` }}
                />
              );
            })}
          </g>
        )}
      </svg>

      {/* State label */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-6 text-xs font-mono tracking-widest uppercase transition-all duration-300"
        style={{ color: glowColor, textShadow: `0 0 8px ${glowColor}` }}
      >
        {state === "idle" && "STANDBY"}
        {state === "listening" && "LISTENING"}
        {state === "thinking" && "PROCESSING"}
        {state === "speaking" && "RESPONDING"}
      </div>
    </div>
  );
}
