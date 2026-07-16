/**
 * WeatherWindow — Full weather dashboard
 * Current conditions, hourly/daily forecast, air quality, NWS alerts
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Cloud, CloudRain, Sun, Wind, Droplets, Eye, Thermometer, AlertTriangle, Search, Loader2 } from "lucide-react";

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Rain", 65: "Heavy rain", 71: "Slight snow", 73: "Snow", 75: "Heavy snow",
  77: "Snow grains", 80: "Rain showers", 81: "Rain showers", 82: "Violent rain showers",
  85: "Snow showers", 86: "Heavy snow showers", 95: "Thunderstorm", 96: "Thunderstorm + hail", 99: "Thunderstorm + heavy hail",
};

const WMO_EMOJI: Record<number, string> = {
  0: "️", 1: "🌤", 2: "⛅", 3: "☁️", 45: "", 48: "", 51: "🌦", 53: "🌦", 55: "🌧",
  61: "🌦", 63: "🌧", 65: "🌧", 71: "🌨", 73: "❄️", 75: "️", 77: "️",
  80: "", 81: "🌧", 82: "⛈", 85: "🌨", 86: "️", 95: "⛈", 96: "⛈", 99: "⛈",
};

export function WeatherWindow({ data }: { data?: any }) {
  const [location, setLocation] = useState(data?.location ?? "New York");
  const [searchInput, setSearchInput] = useState(location);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(data?.coords ?? null);

  const geocode = trpc.maps.geocode.useMutation({
    onSuccess: (result) => {
      if (result) {
        setCoords({ lat: result.lat, lon: result.lng });
        setLocation(result.name ?? location);
      }
    },
  });

  const weather = trpc.sentinel.getOpenMeteoWeather.useQuery(
    { lat: coords?.lat ?? 40.7128, lon: coords?.lon ?? -74.006 },
    { enabled: !!coords }
  );

  const airQuality = trpc.sentinel.getAirQuality.useQuery(
    { lat: coords?.lat ?? 40.7128, lon: coords?.lon ?? -74.006 },
    { enabled: !!coords }
  );

  const nwsAlerts = trpc.sentinel.getNwsAlerts.useQuery(
    { lat: coords?.lat ?? 40.7128, lon: coords?.lon ?? -74.006 },
    { enabled: !!coords }
  );

  const handleSearch = () => {
    if (searchInput.trim()) {
      geocode.mutate({ query: searchInput.trim() });
    }
  };

  const current = weather.data?.current;
  const hourly = weather.data?.hourly;
  const daily = weather.data?.daily;
  const aqi = airQuality.data;
  const alerts = nwsAlerts.data ?? [];

  const severityColor = (severity?: string) => {
    switch (severity?.toLowerCase()) {
      case "extreme": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "severe": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "moderate": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default: return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#050a0f] text-white">
      {/* Search bar */}
      <div className="flex items-center gap-2 p-3 border-b border-white/5">
        <Search className="w-4 h-4 text-white/40" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search location..."
          className="bg-white/5 border-white/10 text-white text-sm flex-1"
        />
        <Button
          onClick={handleSearch}
          disabled={geocode.isPending}
          size="sm"
          className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30"
        >
          {geocode.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Go"}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {weather.isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          </div>
        ) : current ? (
          <>
            {/* Current conditions */}
            <div className="text-center">
              <div className="text-5xl mb-2">{WMO_EMOJI[current.weatherCode ?? 0] ?? "🌡"}</div>
              <div className="text-4xl font-bold">{Math.round(current.temperature)}°F</div>
              <div className="text-white/50 text-sm mt-1">
                {WMO_DESCRIPTIONS[current.weatherCode ?? 0] ?? "Unknown"}
              </div>
              <div className="text-white/40 text-xs mt-1">
                Feels like {Math.round(current.apparentTemperature ?? current.temperature)}°F
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                <Wind className="w-4 h-4 text-cyan-400 mb-1" />
                <div className="text-xs text-white/40">Wind</div>
                <div className="text-sm font-medium">{Math.round(current.windSpeed ?? 0)} mph</div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                <Droplets className="w-4 h-4 text-cyan-400 mb-1" />
                <div className="text-xs text-white/40">Humidity</div>
                <div className="text-sm font-medium">{current.relativeHumidity ?? 0}%</div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                <Eye className="w-4 h-4 text-cyan-400 mb-1" />
                <div className="text-xs text-white/40">Visibility</div>
                <div className="text-sm font-medium">{current.visibility ? `${(current.visibility / 1609).toFixed(1)} mi` : "N/A"}</div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                <Thermometer className="w-4 h-4 text-cyan-400 mb-1" />
                <div className="text-xs text-white/40">UV Index</div>
                <div className="text-sm font-medium">{current.uvIndex ?? 0}</div>
              </div>
            </div>

            {/* Hourly forecast */}
            {hourly && hourly.time && (
              <div>
                <h3 className="text-xs text-white/40 mb-2 uppercase tracking-wider">Hourly Forecast</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {hourly.time.slice(0, 12).map((time: string, i: number) => (
                    <div key={i} className="flex-shrink-0 bg-white/[0.03] rounded-lg p-2 border border-white/5 text-center min-w-[60px]">
                      <div className="text-[10px] text-white/40">
                        {new Date(time).toLocaleTimeString("en-US", { hour: "numeric" })}
                      </div>
                      <div className="text-lg my-1">{WMO_EMOJI[hourly.weatherCode?.[i] ?? 0] ?? "🌡"}</div>
                      <div className="text-xs font-medium">{Math.round(hourly.temperature?.[i] ?? 0)}°</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily forecast */}
            {daily && daily.time && (
              <div>
                <h3 className="text-xs text-white/40 mb-2 uppercase tracking-wider">7-Day Forecast</h3>
                <div className="space-y-1">
                  {daily.time.map((day: string, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-white/[0.02] rounded px-3 py-2 border border-white/5">
                      <span className="text-xs text-white/60 w-16">
                        {new Date(day).toLocaleDateString("en-US", { weekday: "short" })}
                      </span>
                      <span className="text-lg">{WMO_EMOJI[daily.weatherCode?.[i] ?? 0] ?? "🌡"}</span>
                      <div className="text-xs">
                        <span className="text-white/80">{Math.round(daily.maxTemperature?.[i] ?? 0)}°</span>
                        <span className="text-white/30 mx-1">/</span>
                        <span className="text-white/40">{Math.round(daily.minTemperature?.[i] ?? 0)}°</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Air Quality */}
            {aqi && (
              <div>
                <h3 className="text-xs text-white/40 mb-2 uppercase tracking-wider">Air Quality</h3>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">AQI (US)</span>
                    <Badge className={
                      (aqi.usEpaIndex ?? 0) <= 2 ? "bg-green-500/20 text-green-400 border-green-500/30" :
                      (aqi.usEpaIndex ?? 0) <= 3 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                      "bg-red-500/20 text-red-400 border-red-500/30"
                    }>
                      {["Good", "Moderate", "Unhealthy (SG)", "Unhealthy", "Very Unhealthy", "Hazardous"][aqi.usEpaIndex ?? 0] ?? "Unknown"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-white/50">
                    <span>PM2.5: {aqi.pm25?.toFixed(1) ?? "N/A"}</span>
                    <span>PM10: {aqi.pm10?.toFixed(1) ?? "N/A"}</span>
                    <span>O₃: {aqi.ozone?.toFixed(1) ?? "N/A"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* NWS Alerts */}
            {alerts.length > 0 && (
              <div>
                <h3 className="text-xs text-white/40 mb-2 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Active Alerts ({alerts.length})
                </h3>
                <div className="space-y-2">
                  {alerts.map((alert: any, i: number) => (
                    <div key={i} className={`rounded-lg p-3 border ${severityColor(alert.severity)}`}>
                      <div className="text-sm font-medium">{alert.event}</div>
                      <div className="text-xs mt-1 opacity-70">{alert.description?.slice(0, 150)}...</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center text-white/40 py-12">
            <CloudRain className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Search for a location to see weather data</p>
          </div>
        )}
      </div>
    </div>
  );
}
