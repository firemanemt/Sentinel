/**
 * Open-Meteo API integration
 * https://open-meteo.com
 *
 * Free, no API key required.
 * Provides: current conditions, hourly forecast, daily forecast, air quality.
 */

const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";

// ── WMO Weather Interpretation Codes ──────────────────────────────────────────
export function wmoDescription(code: number): string {
  const map: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Icy fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    56: "Light freezing drizzle", 57: "Heavy freezing drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Light freezing rain", 67: "Heavy freezing rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    77: "Snow grains",
    80: "Slight showers", 81: "Moderate showers", 82: "Violent showers",
    85: "Slight snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Heavy thunderstorm with hail",
  };
  return map[code] ?? `Code ${code}`;
}

export function wmoEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫";
  if (code <= 57) return "🌦";
  if (code <= 67) return "🌧";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦";
  if (code <= 86) return "🌨";
  return "⛈";
}

// ── Current + Forecast ────────────────────────────────────────────────────────
export interface CurrentWeather {
  time: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  precipitation: number;
  weatherCode: number;
  weatherDesc: string;
  weatherEmoji: string;
  cloudCover: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  pressure: number;
  visibility: number;
  isDay: boolean;
}

export interface HourlyPoint {
  time: string;
  temperature: number;
  feelsLike: number;
  precipProb: number;
  precipitation: number;
  weatherCode: number;
  weatherEmoji: string;
  windSpeed: number;
  cloudCover: number;
  visibility: number;
}

export interface DailyPoint {
  date: string;
  weatherCode: number;
  weatherDesc: string;
  weatherEmoji: string;
  tempMax: number;
  tempMin: number;
  feelsMax: number;
  feelsMin: number;
  sunrise: string;
  sunset: string;
  uvIndex: number;
  precipSum: number;
  precipProbMax: number;
  windSpeedMax: number;
  windGusts: number;
}

export interface WeatherData {
  latitude: number;
  longitude: number;
  timezone: string;
  current: CurrentWeather;
  hourly: HourlyPoint[];  // next 24 hours
  daily: DailyPoint[];    // next 7 days
}

export async function getWeatherData(lat: number, lon: number): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    timezone: "auto",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    forecast_days: "7",
    forecast_hours: "24",
    current: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "precipitation",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "surface_pressure",
      "visibility",
      "is_day",
    ].join(","),
    hourly: [
      "temperature_2m",
      "apparent_temperature",
      "precipitation_probability",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "cloud_cover",
      "visibility",
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "apparent_temperature_max",
      "apparent_temperature_min",
      "sunrise",
      "sunset",
      "uv_index_max",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "wind_gusts_10m_max",
    ].join(","),
  });

  const res = await fetch(`${FORECAST_BASE}?${params}`, {
    headers: { "User-Agent": "SENTINEL/1.0" },
  });
  if (!res.ok) throw new Error(`Open-Meteo error ${res.status}`);
  const data = await res.json() as any;

  const c = data.current;
  const current: CurrentWeather = {
    time: c.time,
    temperature: c.temperature_2m,
    feelsLike: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    precipitation: c.precipitation,
    weatherCode: c.weather_code,
    weatherDesc: wmoDescription(c.weather_code),
    weatherEmoji: wmoEmoji(c.weather_code),
    cloudCover: c.cloud_cover,
    windSpeed: c.wind_speed_10m,
    windDirection: c.wind_direction_10m,
    windGusts: c.wind_gusts_10m,
    pressure: c.surface_pressure,
    visibility: c.visibility,
    isDay: c.is_day === 1,
  };

  const h = data.hourly;
  const hourly: HourlyPoint[] = h.time.map((t: string, i: number) => ({
    time: t,
    temperature: h.temperature_2m[i],
    feelsLike: h.apparent_temperature[i],
    precipProb: h.precipitation_probability[i] ?? 0,
    precipitation: h.precipitation[i] ?? 0,
    weatherCode: h.weather_code[i],
    weatherEmoji: wmoEmoji(h.weather_code[i]),
    windSpeed: h.wind_speed_10m[i],
    cloudCover: h.cloud_cover[i],
    visibility: h.visibility[i],
  }));

  const d = data.daily;
  const daily: DailyPoint[] = d.time.map((date: string, i: number) => ({
    date,
    weatherCode: d.weather_code[i],
    weatherDesc: wmoDescription(d.weather_code[i]),
    weatherEmoji: wmoEmoji(d.weather_code[i]),
    tempMax: d.temperature_2m_max[i],
    tempMin: d.temperature_2m_min[i],
    feelsMax: d.apparent_temperature_max[i],
    feelsMin: d.apparent_temperature_min[i],
    sunrise: d.sunrise[i],
    sunset: d.sunset[i],
    uvIndex: d.uv_index_max[i],
    precipSum: d.precipitation_sum[i] ?? 0,
    precipProbMax: d.precipitation_probability_max[i] ?? 0,
    windSpeedMax: d.wind_speed_10m_max[i],
    windGusts: d.wind_gusts_10m_max[i],
  }));

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
    current,
    hourly,
    daily,
  };
}

// ── Air Quality ───────────────────────────────────────────────────────────────
export interface AirQualityData {
  usAqi: number;
  usAqiLabel: string;
  usAqiColor: string;
  pm25: number;
  pm10: number;
  ozone: number;
  no2: number;
  so2: number;
  co: number;
  uvIndex: number;
}

export function aqiLabel(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

export function aqiColor(aqi: number): string {
  if (aqi <= 50) return "#00e400";
  if (aqi <= 100) return "#ffff00";
  if (aqi <= 150) return "#ff7e00";
  if (aqi <= 200) return "#ff0000";
  if (aqi <= 300) return "#8f3f97";
  return "#7e0023";
}

export async function getAirQuality(lat: number, lon: number): Promise<AirQualityData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current: [
      "us_aqi",
      "pm2_5",
      "pm10",
      "ozone",
      "nitrogen_dioxide",
      "sulphur_dioxide",
      "carbon_monoxide",
      "uv_index",
    ].join(","),
  });

  const res = await fetch(`${AIR_QUALITY_BASE}?${params}`, {
    headers: { "User-Agent": "SENTINEL/1.0" },
  });
  if (!res.ok) throw new Error(`Open-Meteo AQ error ${res.status}`);
  const data = await res.json() as any;
  const c = data.current;

  const aqi = c.us_aqi ?? 0;
  return {
    usAqi: aqi,
    usAqiLabel: aqiLabel(aqi),
    usAqiColor: aqiColor(aqi),
    pm25: c.pm2_5 ?? 0,
    pm10: c.pm10 ?? 0,
    ozone: c.ozone ?? 0,
    no2: c.nitrogen_dioxide ?? 0,
    so2: c.sulphur_dioxide ?? 0,
    co: c.carbon_monoxide ?? 0,
    uvIndex: c.uv_index ?? 0,
  };
}
