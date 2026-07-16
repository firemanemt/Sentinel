import { trpc } from "@/lib/trpc";

// WMO weather code → emoji icon
function weatherIcon(code: number): string {
  if (code === 0) return "☀";
  if (code <= 2) return "🌤";
  if (code === 3) return "☁";
  if (code <= 48) return "🌫";
  if (code <= 55) return "🌦";
  if (code <= 65) return "🌧";
  if (code <= 77) return "❄";
  if (code <= 82) return "🌦";
  if (code <= 86) return "🌨";
  return "⛈";
}

interface WeatherForecastPanelProps {
  location: string;
  className?: string;
}

export function WeatherForecastPanel({ location, className = "" }: WeatherForecastPanelProps) {
  const { data, isLoading, error } = trpc.sentinel.getWeatherForecast.useQuery(
    { location, days: 5 },
    { enabled: !!location, staleTime: 10 * 60 * 1000, refetchInterval: 30 * 60 * 1000 }
  );

  const panelStyle: React.CSSProperties = {
    border: "1px solid rgba(0,200,255,0.2)",
    background: "rgba(0,10,20,0.6)",
    borderRadius: "2px",
  };

  const headerStyle: React.CSSProperties = {
    borderBottom: "1px solid rgba(0,200,255,0.15)",
    padding: "4px 8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };

  if (isLoading) {
    return (
      <div style={panelStyle} className={className}>
        <div style={headerStyle}>
          <span style={{ color: "rgba(0,200,255,0.6)", fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.15em" }}>
            METEOROLOGICAL DATA
          </span>
        </div>
        <div style={{ padding: "8px", textAlign: "center" }}>
          <span style={{ color: "rgba(0,200,255,0.3)", fontFamily: "monospace", fontSize: "9px" }}>FETCHING...</span>
        </div>
      </div>
    );
  }

  if (error || !data?.days?.length) {
    return (
      <div style={panelStyle} className={className}>
        <div style={headerStyle}>
          <span style={{ color: "rgba(0,200,255,0.6)", fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.15em" }}>
            METEOROLOGICAL DATA
          </span>
        </div>
        <div style={{ padding: "8px", textAlign: "center" }}>
          <span style={{ color: "rgba(0,200,255,0.25)", fontFamily: "monospace", fontSize: "9px" }}>
            {location ? "NO DATA" : "SET HOME ZIP"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyle} className={className}>
      <div style={headerStyle}>
        <span style={{ color: "rgba(0,200,255,0.6)", fontFamily: "monospace", fontSize: "9px", letterSpacing: "0.15em" }}>
          METEOROLOGICAL DATA
        </span>
        <span style={{ color: "rgba(0,200,255,0.35)", fontFamily: "monospace", fontSize: "8px" }}>
          {data.location?.split(",")[0]?.toUpperCase() ?? ""}
        </span>
      </div>
      <div style={{ padding: "4px 6px" }}>
        {data.days.map((day, i) => (
          <div
            key={day.date}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "3px 2px",
              borderBottom: i < data.days.length - 1 ? "1px solid rgba(0,200,255,0.07)" : "none",
            }}
          >
            <span style={{ color: "rgba(0,200,255,0.7)", fontFamily: "monospace", fontSize: "9px", width: "28px" }}>
              {i === 0 ? "TODAY" : day.dayOfWeek.slice(0, 3).toUpperCase()}
            </span>
            <span style={{ fontSize: "12px" }}>{weatherIcon(day.weatherCode)}</span>
            <div style={{ textAlign: "right" }}>
              <span style={{ color: "rgba(0,220,255,0.9)", fontFamily: "monospace", fontSize: "10px" }}>
                {day.tempHigh}°
              </span>
              <span style={{ color: "rgba(0,200,255,0.4)", fontFamily: "monospace", fontSize: "9px", marginLeft: "3px" }}>
                {day.tempLow}°
              </span>
            </div>
            {day.precipitationChance > 20 && (
              <span style={{ color: "rgba(100,180,255,0.6)", fontFamily: "monospace", fontSize: "8px", marginLeft: "2px" }}>
                {day.precipitationChance}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
