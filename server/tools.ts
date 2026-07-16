/**
 * SENTINEL Tool Integrations
 * - Weather: Open-Meteo (free, no API key required)
 * - Geocoding: Open-Meteo geocoding API (free, no key)
 * - Web Search: DuckDuckGo Instant Answer API (free, no key)
 */

export interface WeatherResult {
  location: string;
  temperature: number;
  temperatureUnit: string;
  feelsLike: number;
  description: string;
  humidity: number;
  windSpeed: number;
  windUnit: string;
  isDay: boolean;
}

export interface ForecastDay {
  date: string;
  dayOfWeek: string;
  tempHigh: number;
  tempLow: number;
  description: string;
  weatherCode: number;
  precipitationChance: number;
  windSpeed: number;
}

export interface ForecastResult {
  location: string;
  days: ForecastDay[];
}

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export interface SearchToolResult {
  query: string;
  answer?: string;
  results: SearchResult[];
}

const WMO_CODES: Record<number, string> = {
  0: "clear skies",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "foggy",
  48: "icy fog",
  51: "light drizzle",
  53: "moderate drizzle",
  55: "dense drizzle",
  61: "slight rain",
  63: "moderate rain",
  65: "heavy rain",
  71: "slight snow",
  73: "moderate snow",
  75: "heavy snow",
  77: "snow grains",
  80: "slight showers",
  81: "moderate showers",
  82: "violent showers",
  85: "slight snow showers",
  86: "heavy snow showers",
  95: "thunderstorm",
  96: "thunderstorm with slight hail",
  99: "thunderstorm with heavy hail",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function geocodeLocation(location: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = await res.json() as { results?: Array<{ latitude: number; longitude: number; name: string; country?: string }> };
  const first = data.results?.[0];
  if (!first) return null;
  return {
    lat: first.latitude,
    lon: first.longitude,
    name: first.country ? `${first.name}, ${first.country}` : first.name,
  };
}

export async function getWeather(location: string): Promise<WeatherResult> {
  const geo = await geocodeLocation(location);
  if (!geo) {
    throw new Error(`I was unable to locate "${location}" in my geographical database, sir.`);
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    throw new Error("The meteorological data feed is temporarily unavailable.");
  }

  const data = await res.json() as {
    current: {
      temperature_2m: number;
      apparent_temperature: number;
      relative_humidity_2m: number;
      wind_speed_10m: number;
      weather_code: number;
      is_day: number;
    };
  };

  const c = data.current;
  return {
    location: geo.name,
    temperature: Math.round(c.temperature_2m),
    temperatureUnit: "°F",
    feelsLike: Math.round(c.apparent_temperature),
    description: WMO_CODES[c.weather_code] ?? "conditions unknown",
    humidity: c.relative_humidity_2m,
    windSpeed: Math.round(c.wind_speed_10m),
    windUnit: "mph",
    isDay: c.is_day === 1,
  };
}

export async function getWeatherForecast(location: string, days: number = 5): Promise<ForecastResult> {
  const geo = await geocodeLocation(location);
  if (!geo) {
    throw new Error(`I was unable to locate "${location}" in my geographical database, sir.`);
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=${days}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    throw new Error("The meteorological forecast feed is temporarily unavailable.");
  }

  const data = await res.json() as {
    daily: {
      time: string[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      weather_code: number[];
      precipitation_probability_max: number[];
      wind_speed_10m_max: number[];
    };
  };

  const d = data.daily;
  const forecastDays: ForecastDay[] = d.time.map((dateStr, i) => {
    const date = new Date(dateStr + "T12:00:00");
    return {
      date: dateStr,
      dayOfWeek: DAY_NAMES[date.getDay()] ?? dateStr,
      tempHigh: Math.round(d.temperature_2m_max[i] ?? 0),
      tempLow: Math.round(d.temperature_2m_min[i] ?? 0),
      description: WMO_CODES[d.weather_code[i] ?? 0] ?? "conditions unknown",
      weatherCode: d.weather_code[i] ?? 0,
      precipitationChance: d.precipitation_probability_max[i] ?? 0,
      windSpeed: Math.round(d.wind_speed_10m_max[i] ?? 0),
    };
  });

  return { location: geo.name, days: forecastDays };
}

export async function webSearch(query: string): Promise<SearchToolResult> {
  // DuckDuckGo Instant Answer API
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SENTINEL-Assistant/3.0" },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error("The search data feed is temporarily unavailable.");
  }

  const data = await res.json() as {
    AbstractText?: string;
    AbstractURL?: string;
    AbstractSource?: string;
    RelatedTopics?: Array<{
      Text?: string;
      FirstURL?: string;
      Topics?: Array<{ Text?: string; FirstURL?: string }>;
    }>;
    Answer?: string;
    Heading?: string;
  };

  const results: SearchResult[] = [];

  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title: data.AbstractSource ?? data.Heading ?? query,
      snippet: data.AbstractText,
      url: data.AbstractURL,
    });
  }

  for (const topic of data.RelatedTopics ?? []) {
    if (topic.Text && topic.FirstURL) {
      results.push({ title: topic.Text.split(" - ")[0] ?? topic.Text, snippet: topic.Text, url: topic.FirstURL });
    }
    for (const sub of topic.Topics ?? []) {
      if (sub.Text && sub.FirstURL) {
        results.push({ title: sub.Text.split(" - ")[0] ?? sub.Text, snippet: sub.Text, url: sub.FirstURL });
      }
    }
    if (results.length >= 5) break;
  }

  return {
    query,
    answer: data.Answer || data.AbstractText || undefined,
    results: results.slice(0, 5),
  };
}
