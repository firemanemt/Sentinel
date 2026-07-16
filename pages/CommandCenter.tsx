import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpEntry { time_tag: string; kp: number }
interface Geofence {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusMi: number;
  active: boolean;
  seenIds: Set<string>; // IDs of events already alerted
}
interface GdeltArticle { url: string; title: string; seendate: string; sourcecountry?: string; domain?: string }
interface GdeltGeoPoint {
  lat: number; lon: number; name?: string; count?: number;
  type?: string; status?: string; parties?: string; since?: string;
  description?: string; casualties?: string; region?: string;
  // GDELT live fields
  avgGoldstein?: number; country?: string; sources?: string[]; isLive?: boolean;
  // 24h trend fields
  count24h?: number; avgGoldstein24h?: number;
  trend?: 'ESCALATING' | 'DE-ESCALATING' | 'STABLE';
  trendDelta?: number;
}
interface GlobeArc {
  lat1: number; lon1: number; lat2: number; lon2: number;
  goldstein: number; name: string;
}
interface MarketItem { symbol: string; price: number; change: number; changePct: number; currency: string }
interface KevItem { cveID: string; vulnerabilityName: string; dateAdded: string; shortDescription: string; product: string; vendorProject: string }
interface Launch { id: string; name: string; net: string; status: { name: string }; rocket?: { configuration?: { name: string } }; launch_service_provider?: { name: string } }

interface SatPoint { lat: number; lon: number; name: string; id: string; alt?: number }
interface QuakePoint { lat: number; lon: number; mag: number; place: string; time: number; depth: number; url: string }
interface NatEvent { lat: number; lon: number; title: string; category: string; categoryId: string; date: string; link: string; id: string }

type Panel = 'news' | 'markets' | 'weather' | 'cyber' | 'launches' | 'geofences' | null;
type OverlayKey = 'conflicts' | 'radar' | 'satellites' | 'earthquakes' | 'events' | 'arcs';
type SelectedPoint = { kind: 'conflict'; data: GdeltGeoPoint } | { kind: 'satellite'; data: SatPoint } | { kind: 'quake'; data: QuakePoint } | { kind: 'event'; data: NatEvent };

// ─── Constants ────────────────────────────────────────────────────────────────

const MARKET_LABELS: Record<string, string> = {
  SPY: 'S&P 500', QQQ: 'NASDAQ', '^DJI': 'DOW', 'GC=F': 'GOLD', 'CL=F': 'OIL', 'BTC-USD': 'BTC',
};

// Known satellites with approximate TLE-derived orbital data (fallback when live API unavailable)
// ISS is fetched live; others are computed from embedded TLE
const KNOWN_SATS: SatPoint[] = [
  { id: 'ISS', name: 'ISS (ZARYA)', lat: 0, lon: 0, alt: 408 },
  { id: 'HST', name: 'Hubble Space Telescope', lat: 28.5, lon: -80.6, alt: 537 },
  { id: 'TIANGONG', name: 'Tiangong Space Station', lat: 41.5, lon: 120.0, alt: 390 },
];

const EVENT_COLORS: Record<string, string> = {
  'Wildfires': '#ff6600',
  'Volcanoes': '#ff3300',
  'Severe Storms': '#ffcc00',
  'Floods': '#0099ff',
  'Earthquakes': '#ff9900',
  'Sea and Lake Ice': '#aaddff',
  'Landslides': '#cc6600',
  'Drought': '#cc9900',
  'Dust and Haze': '#ccaa66',
  'Manmade': '#ff00ff',
  'Snow': '#eeeeff',
  'Temperature Extremes': '#ff4400',
  'default': '#00d4ff',
};

// ─── Label data (zoom-aware) ─────────────────────────────────────────────────

const CAPITALS: { lat: number; lon: number; name: string }[] = [
  { lat: 38.9, lon: -77.0, name: 'Washington DC' }, { lat: 51.5, lon: -0.1, name: 'London' },
  { lat: 48.9, lon: 2.3, name: 'Paris' }, { lat: 55.8, lon: 37.6, name: 'Moscow' },
  { lat: 39.9, lon: 116.4, name: 'Beijing' }, { lat: 35.7, lon: 139.7, name: 'Tokyo' },
  { lat: 28.6, lon: 77.2, name: 'New Delhi' }, { lat: -15.8, lon: -47.9, name: 'Brasília' },
  { lat: -33.9, lon: 18.4, name: 'Cape Town' }, { lat: 30.1, lon: 31.2, name: 'Cairo' },
  { lat: 52.5, lon: 13.4, name: 'Berlin' }, { lat: 41.9, lon: 12.5, name: 'Rome' },
  { lat: 40.4, lon: -3.7, name: 'Madrid' }, { lat: 59.9, lon: 10.7, name: 'Oslo' },
  { lat: 37.6, lon: 127.0, name: 'Seoul' }, { lat: 25.2, lon: 55.3, name: 'Dubai' },
  { lat: 31.8, lon: 35.2, name: 'Jerusalem' }, { lat: 33.3, lon: 44.4, name: 'Baghdad' },
  { lat: 35.7, lon: 51.4, name: 'Tehran' }, { lat: 33.7, lon: -117.8, name: 'Kyiv' },
  { lat: 50.5, lon: 30.5, name: 'Kyiv' }, { lat: 24.7, lon: 46.7, name: 'Riyadh' },
  { lat: 1.3, lon: 103.8, name: 'Singapore' }, { lat: -6.2, lon: 106.8, name: 'Jakarta' },
  { lat: 13.8, lon: 100.5, name: 'Bangkok' }, { lat: 3.1, lon: 101.7, name: 'Kuala Lumpur' },
];

const MAJOR_CITIES: { lat: number; lon: number; name: string }[] = [
  ...CAPITALS,
  { lat: 40.7, lon: -74.0, name: 'New York' }, { lat: 34.1, lon: -118.2, name: 'Los Angeles' },
  { lat: 41.9, lon: -87.6, name: 'Chicago' }, { lat: 29.8, lon: -95.4, name: 'Houston' },
  { lat: 43.7, lon: -79.4, name: 'Toronto' }, { lat: 45.5, lon: -73.6, name: 'Montreal' },
  { lat: -23.5, lon: -46.6, name: 'São Paulo' }, { lat: -34.6, lon: -58.4, name: 'Buenos Aires' },
  { lat: 19.4, lon: -99.1, name: 'Mexico City' }, { lat: -33.9, lon: 151.2, name: 'Sydney' },
  { lat: -37.8, lon: 144.9, name: 'Melbourne' }, { lat: 22.3, lon: 114.2, name: 'Hong Kong' },
  { lat: 23.1, lon: 113.3, name: 'Guangzhou' }, { lat: 31.2, lon: 121.5, name: 'Shanghai' },
  { lat: 19.1, lon: 72.9, name: 'Mumbai' }, { lat: 12.9, lon: 77.6, name: 'Bangalore' },
  { lat: 6.5, lon: 3.4, name: 'Lagos' }, { lat: -1.3, lon: 36.8, name: 'Nairobi' },
  { lat: 14.7, lon: -17.4, name: 'Dakar' }, { lat: 5.6, lon: -0.2, name: 'Accra' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommandCenter() {
  const globeRef = useRef<HTMLDivElement>(null);
  const globeInstanceRef = useRef<any>(null);

  // Status bar data
  const [kp, setKp] = useState<number | null>(null);
  const [kpStatus, setKpStatus] = useState('');
  const [milFlights, setMilFlights] = useState<number | null>(null);
  const [conflictCount, setConflictCount] = useState<number | null>(null);

  // Panel data
  const [newsItems, setNewsItems] = useState<GdeltArticle[]>([]);
  const [tickerItems, setTickerItems] = useState<GdeltArticle[]>([]);
  const [markets, setMarkets] = useState<MarketItem[]>([]);
  const [kevItems, setKevItems] = useState<KevItem[]>([]);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [geoPoints, setGeoPoints] = useState<GdeltGeoPoint[]>([]);
  const [rainviewerTs, setRainviewerTs] = useState<string | null>(null);

  // Overlay data
  const [satellites, setSatellites] = useState<SatPoint[]>([]);
  const [earthquakes, setEarthquakes] = useState<QuakePoint[]>([]);
  const [natEvents, setNatEvents] = useState<NatEvent[]>([]);
  const [globeArcs, setGlobeArcs] = useState<GlobeArc[]>([]);

  // Boundary data
  const [countriesGeo, setCountriesGeo] = useState<any>(null);
  const [statesGeo, setStatesGeo] = useState<any>(null);

  // Radar / weather
  const [rainviewerFrames, setRainviewerFrames] = useState<{ time: number; path: string }[]>([]);
  const [radarFrameIdx, setRadarFrameIdx] = useState<number>(0);
  const [precipForecast, setPrecipForecast] = useState<{ time: string; precip: number }[]>([]);

  // UI state
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [intelQuery, setIntelQuery] = useState<string | null>(null);
  const [nightMode, setNightMode] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(2.5); // globe altitude
  const [overlays, setOverlays] = useState<Record<OverlayKey, boolean>>({
    conflicts: true,
    radar: false,
    satellites: false,
    earthquakes: false,
    events: false,
    arcs: false,
  });
  const [time, setTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);

  // Radar playback
  const [radarPlaying, setRadarPlaying] = useState(false);
  const [radarSpeed, setRadarSpeed] = useState<500 | 250 | 1000>(500); // ms per frame
  const radarPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Geofences
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [drawMode, setDrawMode] = useState<'idle' | 'center' | 'radius'>('idle');
  const [drawCenter, setDrawCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [drawName, setDrawName] = useState('Zone Alpha');

  // ── Clock ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Fetch helpers ─────────────────────────────────────────────────────────
  const fetchKp = useCallback(async () => {
    try {
      const r = await fetch('/api/command-center/kp');
      const d = await r.json() as KpEntry[];
      if (Array.isArray(d) && d.length) {
        const latest = d[d.length - 1];
        const kpVal = parseFloat(String(latest.kp));
        if (!isNaN(kpVal)) {
          setKp(kpVal);
          setKpStatus(kpVal >= 5 ? 'STORM' : kpVal >= 3 ? 'UNSETTLED' : 'QUIET');
        }
      }
    } catch { /* silent */ }
  }, []);

  const fetchMilFlights = useCallback(async () => {
    try {
      const r = await fetch('/api/command-center/mil-flights');
      const d = await r.json() as { count: number };
      setMilFlights(d.count ?? null);
    } catch { /* silent */ }
  }, []);

  const fetchGdeltNews = useCallback(async () => {
    try {
      const r = await fetch('/api/command-center/gdelt-news');
      const d = await r.json() as { articles?: GdeltArticle[] };
      const items = d.articles || [];
      setNewsItems(items);
      setTickerItems(items);
    } catch { /* silent */ }
  }, []);

  const fetchGdeltGeo = useCallback(async () => {
    try {
      // Use 24h endpoint for richer trend + arc data; fall back to 15-min if it fails
      let d: { features?: any[]; arcs?: any[]; isLive?: boolean };
      try {
        const r = await fetch('/api/command-center/gdelt-24h');
        d = await r.json();
      } catch {
        const r = await fetch('/api/command-center/gdelt-geo');
        d = await r.json();
      }
      const points: GdeltGeoPoint[] = (d.features || [])
        .filter((f: any) => f.geometry?.coordinates)
        .map((f: any) => ({
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          name: f.properties?.name || '',
          count: f.properties?.count || 1,
          type: f.properties?.type,
          status: f.properties?.status,
          parties: f.properties?.parties,
          since: f.properties?.since,
          description: f.properties?.description,
          casualties: f.properties?.casualties,
          region: f.properties?.region,
          avgGoldstein: f.properties?.avgGoldstein,
          country: f.properties?.country,
          sources: f.properties?.sources,
          isLive: d.isLive ?? false,
          count24h: f.properties?.count24h,
          avgGoldstein24h: f.properties?.avgGoldstein24h,
          trend: f.properties?.trend,
          trendDelta: f.properties?.trendDelta,
        }));
      setGeoPoints(points);
      setConflictCount(points.length);
      // Store arc data for globe
      if (d.arcs && Array.isArray(d.arcs)) {
        setGlobeArcs(d.arcs.map((a: any) => ({
          lat1: a.lat1, lon1: a.lon1, lat2: a.lat2, lon2: a.lon2,
          goldstein: a.goldstein, name: a.name || '',
        })));
      }
    } catch { /* silent */ }
  }, []);

  const fetchMarkets = useCallback(async () => {
    try {
      const r = await fetch('/api/command-center/markets');
      const d = await r.json() as { markets: MarketItem[] };
      setMarkets(d.markets || []);
    } catch { /* silent */ }
  }, []);

  const fetchKev = useCallback(async () => {
    try {
      const r = await fetch('/api/command-center/cisa-kev');
      const d = await r.json() as { vulnerabilities: KevItem[] };
      setKevItems(d.vulnerabilities || []);
    } catch { /* silent */ }
  }, []);

  const fetchLaunches = useCallback(async () => {
    try {
      const r = await fetch('/api/command-center/launches');
      const d = await r.json() as { results: Launch[] };
      setLaunches(d.results || []);
    } catch { /* silent */ }
  }, []);

  const fetchRainviewer = useCallback(async () => {
    try {
      const r = await fetch('/api/command-center/rainviewer');
      const d = await r.json() as { radar?: { past?: { time: number; path: string }[] } };
      const past = d.radar?.past;
      if (past && past.length) {
        setRainviewerFrames(past);
        setRadarFrameIdx(past.length - 1); // default to latest frame
        setRainviewerTs(past[past.length - 1].path);
      }
    } catch { /* silent */ }
  }, []);

  const fetchBoundaries = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        fetch('/api/command-center/boundaries/countries'),
        fetch('/api/command-center/boundaries/states'),
      ]);
      const [cData, sData] = await Promise.all([cRes.json(), sRes.json()]);
      setCountriesGeo(cData);
      setStatesGeo(sData);
    } catch { /* silent */ }
  }, []);

  const fetchPrecipForecast = useCallback(async () => {
    try {
      const r = await fetch('/api/command-center/precip-forecast?lat=40.7&lon=-74.0');
      const d = await r.json() as { times: string[]; precipitation: number[]; probability: number[] };
      if (d.times && d.precipitation) {
        const mapped = d.times.map((t, i) => ({ time: t, precip: d.precipitation[i] ?? 0 }));
        setPrecipForecast(mapped);
      }
    } catch { /* silent */ }
  }, []);

  const fetchSatellites = useCallback(async () => {
    try {
      const r = await fetch('/api/command-center/iss');
      const d = await r.json() as { lat: number; lon: number; timestamp: number };
      if (d.lat != null) {
        setSatellites(prev => {
          const updated = [...KNOWN_SATS];
          updated[0] = { ...updated[0], lat: d.lat, lon: d.lon };
          return updated;
        });
      }
    } catch {
      setSatellites(KNOWN_SATS);
    }
  }, []);

  const fetchEarthquakes = useCallback(async () => {
    try {
      const r = await fetch('/api/command-center/earthquakes');
      const d = await r.json() as { features: QuakePoint[] };
      setEarthquakes(d.features || []);
    } catch { /* silent */ }
  }, []);

  const fetchNatEvents = useCallback(async () => {
    try {
      const r = await fetch('/api/command-center/natural-events');
      const d = await r.json() as { events: NatEvent[] };
      setNatEvents(d.events || []);
    } catch { /* silent */ }
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const maxLoadTimer = setTimeout(() => setLoading(false), 3000);
    Promise.allSettled([
      fetchKp(), fetchMilFlights(), fetchGdeltNews(), fetchGdeltGeo(),
      fetchMarkets(), fetchKev(), fetchLaunches(), fetchRainviewer(),
      fetchSatellites(), fetchEarthquakes(), fetchNatEvents(),
      fetchBoundaries(), fetchPrecipForecast(),
    ]).then(() => { clearTimeout(maxLoadTimer); setLoading(false); });

    const intervals = [
      setInterval(fetchKp, 60_000),
      setInterval(fetchMilFlights, 120_000),
      setInterval(fetchGdeltNews, 300_000),
      setInterval(fetchGdeltGeo, 300_000),
      setInterval(fetchMarkets, 60_000),
      setInterval(fetchRainviewer, 600_000),
      setInterval(fetchSatellites, 10_000),   // ISS updates every 10s
      setInterval(fetchEarthquakes, 300_000),
      setInterval(fetchNatEvents, 600_000),
    ];
    return () => { intervals.forEach(clearInterval); clearTimeout(maxLoadTimer); };
  }, [fetchKp, fetchMilFlights, fetchGdeltNews, fetchGdeltGeo, fetchMarkets,
      fetchRainviewer, fetchSatellites, fetchEarthquakes, fetchNatEvents,
      fetchBoundaries, fetchPrecipForecast]);


  // -- Radar playback --
  useEffect(() => {
    if (radarPlayRef.current) clearInterval(radarPlayRef.current);
    if (!radarPlaying || rainviewerFrames.length === 0) return;
    radarPlayRef.current = setInterval(() => {
      setRadarFrameIdx(prev => {
        const next = (prev + 1) % rainviewerFrames.length;
        setRainviewerTs(rainviewerFrames[next].path);
        return next;
      });
    }, radarSpeed);
    return () => { if (radarPlayRef.current) clearInterval(radarPlayRef.current); };
  }, [radarPlaying, radarSpeed, rainviewerFrames]);

  // -- Geofence alert check --
  useEffect(() => {
    if (geofences.length === 0) return;
    const activeZones = geofences.filter(g => g.active);
    if (activeZones.length === 0) return;
    const allEvents: { id: string; lat: number; lon: number; label: string; type: string }[] = [
      ...earthquakes.map(q => ({ id: `quake-${q.time}`, lat: q.lat, lon: q.lon, label: `M${q.mag.toFixed(1)} ${q.place}`, type: '🌋 Earthquake' })),
      ...natEvents.map(e => ({ id: `event-${e.id}`, lat: e.lat, lon: e.lon, label: e.title, type: '🌪 Natural Event' })),
      ...geoPoints.map(p => ({ id: `conflict-${p.lat.toFixed(2)}-${p.lon.toFixed(2)}`, lat: p.lat, lon: p.lon, label: p.name || 'Conflict Zone', type: '⚔️ Conflict' })),
    ];
    setGeofences(prev => prev.map(zone => {
      if (!zone.active) return zone;
      const newSeen = new Set(zone.seenIds);
      allEvents.forEach(ev => {
        if (newSeen.has(ev.id)) return;
        const dist = haversineDistanceMi(zone.lat, zone.lon, ev.lat, ev.lon);
        if (dist <= zone.radiusMi) {
          newSeen.add(ev.id);
          toast(`🚨 GEOFENCE: ${zone.name}`, {
            description: `${ev.type} — ${dist.toFixed(0)} mi from center\n${ev.label}`,
            duration: 8000,
            style: { background: '#0a0f14', border: '1px solid #ff3333', color: '#ff6666', fontFamily: 'monospace', fontSize: 12 },
          });
        }
      });
      return { ...zone, seenIds: newSeen };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earthquakes, natEvents, geoPoints]);

  // ── Globe ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!globeRef.current) return;
    let globe: any;
    let destroyed = false;

    const initGlobe = async () => {
      try {
        const GlobeGL = (await import('globe.gl')).default;
        if (destroyed || !globeRef.current) return;

        globe = new GlobeGL(globeRef.current);
        globeInstanceRef.current = globe;

        globe
          .width(globeRef.current.clientWidth)
          .height(globeRef.current.clientHeight)
          .backgroundColor('rgba(0,0,0,0)')
          // Progressive tiled satellite imagery — loads higher-res tiles as user zooms in
          // Proxied through our server to avoid CORS issues in production
          .globeTileEngineUrl((x: number, y: number, level: number) =>
            `/api/command-center/tiles/${level}/${y}/${x}`
          )
          .globeTileEngineMaxLevel(17)
          .atmosphereColor('#00d4ff')
          .atmosphereAltitude(0.15)
          .showGraticules(true)
          // ── Conflict zones (default layer) ──
          .pointsData([])
          .pointLat('lat')
          .pointLng('lon')
          .pointColor((d: any) => d._layer === 'sat' ? '#00ffff' : d._layer === 'quake' ? magColor(d.mag) : d._layer === 'event' ? (EVENT_COLORS[d.category] || EVENT_COLORS.default) : '#ff3333')
          .pointAltitude((d: any) => d._layer === 'sat' ? 0.08 : 0.01)
          .pointRadius((d: any) => {
            if (d._layer === 'sat') return 0.3;
            if (d._layer === 'quake') return Math.max(0.1, (d.mag - 2) * 0.12);
            if (d._layer === 'event') return 0.25;
            return Math.min(0.5, 0.1 + (d.count || 1) * 0.02);
          })
          .pointLabel(() => '')
          .onPointClick((point: any) => {
            if (point._layer === 'sat') setSelectedPoint({ kind: 'satellite', data: point as SatPoint });
            else if (point._layer === 'quake') setSelectedPoint({ kind: 'quake', data: point as QuakePoint });
            else if (point._layer === 'event') setSelectedPoint({ kind: 'event', data: point as NatEvent });
            else setSelectedPoint({ kind: 'conflict', data: point as GdeltGeoPoint });
            // Pause rotation while popup is open (restored on close)
            if (globe?.controls()) globe.controls().autoRotate = false;
          })
          .enablePointerInteraction(true)
          // ── Arc lines (conflict actor pairs) ──
          .arcsData([])
          .arcStartLat((d: any) => d.lat1)
          .arcStartLng((d: any) => d.lon1)
          .arcEndLat((d: any) => d.lat2)
          .arcEndLng((d: any) => d.lon2)
          .arcColor((d: any) => {
            const g = d.goldstein ?? 0;
            return g <= -8 ? ['rgba(255,0,0,0.8)', 'rgba(255,0,0,0)'] :
                   g <= -5 ? ['rgba(255,51,51,0.7)', 'rgba(255,51,51,0)'] :
                   g <= -2 ? ['rgba(255,170,0,0.6)', 'rgba(255,170,0,0)'] :
                             ['rgba(0,212,255,0.5)', 'rgba(0,212,255,0)'];
          })
          .arcAltitude(0.15)
          .arcStroke(0.4)
          .arcDashLength(0.4)
          .arcDashGap(0.6)
          .arcDashAnimateTime(2500)
          .arcLabel((d: any) => d.name || '')
          // ── Country/State boundary polygons (hybrid mode) ──
          .polygonsData([])
          .polygonCapColor(() => 'rgba(0,0,0,0)')
          .polygonSideColor(() => 'rgba(0,0,0,0)')
          .polygonStrokeColor(() => 'rgba(255,255,255,0.35)')
          .polygonAltitude(0.001)
          // ── Labels (zoom-aware) ──
          .labelsData([])
          .labelLat('lat')
          .labelLng('lon')
          .labelText('name')
          .labelSize((d: any) => d.size || 1.2)
          .labelColor(() => 'rgba(255,255,255,0.85)')
          .labelResolution(2)
          .labelAltitude(0.002);

        // Track zoom level for label density
        globe.onZoom(({ altitude }: { altitude: number }) => {
          setZoomLevel(altitude);
        });

        globe.controls().autoRotate = true;
        globe.controls().autoRotateSpeed = 0.3;
        globe.controls().enableZoom = true;
      } catch (e) {
        console.error('[CommandCenter] Globe init failed:', e);
      }
    };

    initGlobe();

    const handleResize = () => {
      if (globe && globeRef.current) {
        globe.width(globeRef.current.clientWidth).height(globeRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      destroyed = true;
      window.removeEventListener('resize', handleResize);
      if (globe) { try { globe._destructor?.(); } catch { /* ignore */ } }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync all active overlay data to globe ─────────────────────────────────
  useEffect(() => {
    const g = globeInstanceRef.current;
    if (!g) return;
    const pts: any[] = [];
    if (overlays.conflicts) pts.push(...geoPoints.map(p => ({ ...p, _layer: 'conflict' })));
    if (overlays.satellites) pts.push(...satellites.map(s => ({ ...s, _layer: 'sat' })));
    if (overlays.earthquakes) pts.push(...earthquakes.map(q => ({ ...q, _layer: 'quake' })));
    if (overlays.events) pts.push(...natEvents.map(e => ({ ...e, _layer: 'event' })));
    g.pointsData(pts);
  }, [overlays, geoPoints, satellites, earthquakes, natEvents]);

  // ── Sync arc lines ─────────────────────────────────────────────────────────
  useEffect(() => {
    const g = globeInstanceRef.current;
    if (!g) return;
    g.arcsData(overlays.arcs ? globeArcs : []);
  }, [overlays.arcs, globeArcs]);

  // ── Sync boundary polygons to globe ─────────────────────────────────────────
  useEffect(() => {
    const g = globeInstanceRef.current;
    if (!g) return;
    const features: any[] = [];
    if (countriesGeo?.features) features.push(...countriesGeo.features);
    if (statesGeo?.features) features.push(...statesGeo.features);
    g.polygonsData(features);
  }, [countriesGeo, statesGeo]);

  // ── Sync zoom-aware labels ─────────────────────────────────────────────────
  useEffect(() => {
    const g = globeInstanceRef.current;
    if (!g) return;
    const labels: { lat: number; lon: number; name: string; size: number }[] = [];
    if (zoomLevel < 1.5) {
      // Zoomed in: show major cities
      MAJOR_CITIES.forEach(c => labels.push({ ...c, size: 0.8 }));
    } else if (zoomLevel < 3) {
      // Mid zoom: show country capitals
      CAPITALS.forEach(c => labels.push({ ...c, size: 1.0 }));
    }
    // At high altitude (> 3) show no labels to keep globe clean
    g.labelsData(labels);
  }, [zoomLevel]);

  // ── Auto-rotate toggle ───────────────────────────────────────────────────────────
  useEffect(() => {
    const g = globeInstanceRef.current;
    if (!g?.controls()) return;
    g.controls().autoRotate = autoRotate;
  }, [autoRotate]);

  // ── Night/day tile source toggle ───────────────────────────────────────────
  useEffect(() => {
    const g = globeInstanceRef.current;
    if (!g) return;
    if (nightMode) {
      g.globeTileEngineUrl((x: number, y: number, level: number) =>
        `/api/command-center/night-tiles/${level}/${x}/${y}`
      );
    } else {
      g.globeTileEngineUrl((x: number, y: number, level: number) =>
        `/api/command-center/tiles/${level}/${y}/${x}`
      );
    }
    if (g.globeTileEngineClearCache) g.globeTileEngineClearCache();
  }, [nightMode]);

  // ── Weather radar overlay (RainViewer) ────────────────────────────────────
  // Note: globe.gl tilesData is for 3D tile objects, not texture overlays.
  // We use a custom Three.js sphere mesh for the radar overlay instead.
  useEffect(() => {
    const g = globeInstanceRef.current;
    if (!g) return;
    if (!overlays.radar || !rainviewerTs) {
      // Remove existing radar mesh if present
      const scene = g.scene?.();
      if (scene) {
        const existing = scene.getObjectByName('radarOverlay');
        if (existing) scene.remove(existing);
      }
      return;
    }
    // Build a canvas with the radar tile stitched at zoom 2 (4x4 tiles)
    // and apply it as a transparent sphere mesh slightly above the globe
    const THREE = (window as any).THREE || g.renderer?.()?.domElement && (() => {
      try { return require('three'); } catch { return null; }
    })();
    if (!THREE) return;
    const scene = g.scene?.();
    if (!scene) return;
    // Remove old radar overlay
    const old = scene.getObjectByName('radarOverlay');
    if (old) scene.remove(old);
    // Create canvas and load tiles
    const canvas = document.createElement('canvas');
    const tileSize = 256; const gridSize = 4;
    canvas.width = tileSize * gridSize; canvas.height = tileSize * gridSize;
    const ctx = canvas.getContext('2d')!;
    const path = rainviewerTs.startsWith('/') ? rainviewerTs : `/v2/radar/${rainviewerTs}`;
    let loaded = 0;
    const total = gridSize * gridSize;
    for (let tx = 0; tx < gridSize; tx++) {
      for (let ty = 0; ty < gridSize; ty++) {
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => {
          ctx.drawImage(img, tx * tileSize, ty * tileSize, tileSize, tileSize);
          loaded++;
          if (loaded === total) {
            const texture = new THREE.CanvasTexture(canvas);
            const geo = new THREE.SphereGeometry(102, 64, 64);
            const mat = new THREE.MeshBasicMaterial({
              map: texture, transparent: true, opacity: 0.5, depthWrite: false,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.name = 'radarOverlay';
            scene.add(mesh);
          }
        };
        img.src = `/api/command-center/radar-tiles${path}/256/${tx + 1}/${ty + 1}/2/1_1.png`;
      }
    }
  }, [overlays.radar, rainviewerTs]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const kpColor = kp == null ? '#888' : kp >= 5 ? '#ff3333' : kp >= 3 ? '#ffaa00' : '#00ff41';
  const togglePanel = (p: Panel) => setActivePanel(prev => prev === p ? null : p);
  const toggleOverlay = (key: OverlayKey) => setOverlays(prev => ({ ...prev, [key]: !prev[key] }));

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase();

  const closePopup = () => {
    setSelectedPoint(null);
    // Restore rotation to whatever the user has set
    if (globeInstanceRef.current?.controls()) globeInstanceRef.current.controls().autoRotate = autoRotate;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#050a0f',
      fontFamily: '"Roboto Mono", "Courier New", monospace',
      color: '#00ff41', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Top Status Bar ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: 'rgba(0,0,0,0.85)', borderBottom: '1px solid #00ff4133',
        padding: '0 12px', height: 44, flexShrink: 0, zIndex: 100,
        backdropFilter: 'blur(8px)',
      }}>
        <Link href="/app" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 20, cursor: 'pointer' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00ff41', boxShadow: '0 0 8px #00ff41', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#00ff41', fontWeight: 700, fontSize: 14, letterSpacing: 3 }}>SENTINEL</span>
            <span style={{ color: '#444', fontSize: 10, letterSpacing: 2 }}>COMMAND CENTER</span>
          </div>
        </Link>
        <div style={{ width: 1, height: 24, background: '#00ff4133', marginRight: 20 }} />
        <div style={{ marginRight: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#00d4ff', letterSpacing: 2 }}>{formatTime(time)}</div>
          <div style={{ fontSize: 9, color: '#556', letterSpacing: 1 }}>{formatDate(time)} UTC</div>
        </div>
        <div style={{ width: 1, height: 24, background: '#00ff4133', marginRight: 20 }} />
        <StatusChip label="KP INDEX" value={kp != null ? `${kp.toFixed(1)}` : '—'} sub={kpStatus} color={kpColor} />
        <StatusChip label="MIL FLIGHTS" value={milFlights != null ? String(milFlights) : '—'} sub="TRACKED" color="#00d4ff" />
        <StatusChip label="CONFLICTS" value={conflictCount != null ? String(conflictCount) : '—'} sub="ZONES" color="#ff6600" />
        <StatusChip label="QUAKES" value={earthquakes.length ? String(earthquakes.length) : '—'} sub="M2.5+ 24H" color="#ffaa00" />
        <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden', padding: '0 12px' }}>
          {markets.slice(0, 4).map(m => (
            <div key={m.symbol} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
              <span style={{ fontSize: 9, color: '#556', letterSpacing: 1 }}>{MARKET_LABELS[m.symbol] || m.symbol}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: m.change >= 0 ? '#00ff41' : '#ff3333' }}>
                {m.price?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
              <span style={{ fontSize: 9, color: m.change >= 0 ? '#00ff41' : '#ff3333' }}>
                {m.change >= 0 ? '+' : ''}{m.changePct?.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={() => togglePanel('news')}
          style={{
            background: activePanel === 'news' ? '#ff000033' : 'transparent',
            border: `1px solid ${activePanel === 'news' ? '#ff3333' : '#333'}`,
            color: activePanel === 'news' ? '#ff3333' : '#888',
            padding: '4px 12px', borderRadius: 2, cursor: 'pointer',
            fontSize: 11, letterSpacing: 2, fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff3333', animation: 'pulse 1s infinite' }} />
          LIVE NEWS
        </button>
      </div>

      {/* ── Globe Container ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div ref={globeRef} style={{ width: '100%', height: '100%' }} />

        {/* Overlay Legend */}
        <OverlayLegend overlays={overlays} quakeCount={earthquakes.length} eventCount={natEvents.length} satCount={satellites.length} arcCount={globeArcs.length} />

        {/* Point Popup */}
        {selectedPoint && (
          <PointPopup
            point={selectedPoint}
            onClose={closePopup}
            onSearchIntel={(q) => {
              setIntelQuery(q);
              setActivePanel('news');
            }}
          />
        )}

        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexDirection: 'column', gap: 12,
            background: 'rgba(5,10,15,0.8)',
          }}>
            <div style={{ fontSize: 11, letterSpacing: 4, color: '#00ff41', animation: 'blink 1s infinite' }}>RESOLVING PROVIDERS</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0,1,2,3,4].map(i => (
                <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#00ff41', animation: `pulse ${0.5 + i * 0.1}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {/* Side Panel */}
        {activePanel && (
          <SidePanel
            panel={activePanel}
            newsItems={newsItems}
            markets={markets}
            kevItems={kevItems}
            launches={launches}
            rainviewerTs={rainviewerTs}
            rainviewerFrames={rainviewerFrames}
            radarFrameIdx={radarFrameIdx}
            onRadarFrameChange={(idx) => {
              setRadarFrameIdx(idx);
              if (rainviewerFrames[idx]) setRainviewerTs(rainviewerFrames[idx].path);
            }}
            precipForecast={precipForecast}
            weatherOverlay={overlays.radar}
            onToggleWeather={() => toggleOverlay('radar')}
            onClose={() => { setActivePanel(null); setIntelQuery(null); }}
            intelQuery={intelQuery}
            onClearIntelQuery={() => setIntelQuery(null)}
          />
        )}
      </div>

      {/* ── Bottom Toolbar ──────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(0,0,0,0.9)', borderTop: '1px solid #00ff4133',
        display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px',
        height: 52, flexShrink: 0, zIndex: 100, backdropFilter: 'blur(8px)',
        overflowX: 'auto',
      }}>
        {/* Info panels */}
        <ToolbarBtn icon="📰" label="INTEL" active={activePanel === 'news'} onClick={() => togglePanel('news')} />
        <ToolbarSep />
        <ToolbarBtn icon="📈" label="MARKETS" active={activePanel === 'markets'} onClick={() => togglePanel('markets')} />
        <ToolbarSep />
        <ToolbarBtn icon="🌦" label="WEATHER" active={activePanel === 'weather'} onClick={() => togglePanel('weather')} color="#00aaff" />
        <ToolbarSep />
        <ToolbarBtn icon="🛡" label="CYBER" active={activePanel === 'cyber'} onClick={() => togglePanel('cyber')} />
        <ToolbarSep />
        <ToolbarBtn icon="🚀" label="LAUNCHES" active={activePanel === 'launches'} onClick={() => togglePanel('launches')} />
        <ToolbarSep />
        {/* Globe overlays */}
        <div style={{ fontSize: 9, color: '#334', letterSpacing: 2, padding: '0 8px', whiteSpace: 'nowrap' }}>OVERLAYS</div>
        <ToolbarBtn icon="⚔️" label="CONFLICTS" active={overlays.conflicts} onClick={() => toggleOverlay('conflicts')} color="#ff3333" />
        <ToolbarSep />
        <ToolbarBtn icon="🌧" label="RADAR" active={overlays.radar} onClick={() => toggleOverlay('radar')} color="#00aaff" />
        <ToolbarSep />
        <ToolbarBtn icon="🛰" label="SATELLITES" active={overlays.satellites} onClick={() => toggleOverlay('satellites')} color="#00ffff" />
        <ToolbarSep />
        <ToolbarBtn icon="🌋" label="QUAKES" active={overlays.earthquakes} onClick={() => toggleOverlay('earthquakes')} color="#ffaa00" />
        <ToolbarSep />
        <ToolbarBtn icon="🌪" label="EVENTS" active={overlays.events} onClick={() => toggleOverlay('events')} color="#ff6600" />
        <ToolbarSep />
        <ToolbarBtn icon="〰" label="ARCS" active={overlays.arcs} onClick={() => toggleOverlay('arcs')} color="#ff9966" />
        <ToolbarSep />
        {/* Globe controls */}
        <div style={{ fontSize: 9, color: '#334', letterSpacing: 2, padding: '0 8px', whiteSpace: 'nowrap' }}>GLOBE</div>
        <ToolbarBtn icon={nightMode ? '☀️' : '🌙'} label={nightMode ? 'DAY' : 'NIGHT'} active={nightMode} onClick={() => setNightMode(n => !n)} color="#aaaaff" />
        <ToolbarSep />
        <ToolbarBtn icon={autoRotate ? '⏸' : '▶'} label={autoRotate ? 'PAUSE' : 'ROTATE'} active={autoRotate} onClick={() => setAutoRotate(r => !r)} color="#00ff41" />
        <ToolbarSep />
        <div style={{ flex: 1 }} />
        <Link href="/app" style={{ textDecoration: 'none' }}>
          <ToolbarBtn icon="←" label="BACK" active={false} onClick={() => {}} />
        </Link>
      </div>

      {/* ── Bottom Ticker ───────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(0,0,0,0.95)', borderTop: '1px solid #ff000033',
        height: 28, flexShrink: 0, overflow: 'hidden', display: 'flex',
        alignItems: 'center', zIndex: 100,
      }}>
        <div style={{ color: '#ff3333', fontSize: 10, letterSpacing: 2, padding: '0 12px', borderRight: '1px solid #ff000033', whiteSpace: 'nowrap', fontWeight: 700 }}>
          ● LIVE
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 60, whiteSpace: 'nowrap', animation: 'ticker 120s linear infinite' }}>
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ color: '#ccc', fontSize: 11, textDecoration: 'none', display: 'flex', gap: 8, alignItems: 'center' }}>
                {item.sourcecountry && <span style={{ color: '#00d4ff', fontSize: 10 }}>[{item.sourcecountry}]</span>}
                <span>{item.title}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── CSS Animations ──────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes slideIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes popupIn { from{opacity:0;transform:translate(-50%,-50%) scale(0.95)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#0a0a0a}
        ::-webkit-scrollbar-thumb{background:#00ff4144;border-radius:2px}
      `}</style>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function magColor(mag: number): string {
  if (mag >= 7) return '#ff0000';
  if (mag >= 6) return '#ff3300';
  if (mag >= 5) return '#ff6600';
  if (mag >= 4) return '#ffaa00';
  return '#ffcc44';
}

// ─── Overlay Legend ───────────────────────────────────────────────────────────

function OverlayLegend({ overlays, quakeCount, eventCount, satCount, arcCount }: {
  overlays: Record<OverlayKey, boolean>;
  quakeCount: number; eventCount: number; satCount: number; arcCount: number;
}) {
  const items = [
    { key: 'conflicts' as OverlayKey, label: 'CONFLICTS', color: '#ff3333', count: null },
    { key: 'radar' as OverlayKey, label: 'RADAR', color: '#00aaff', count: null },
    { key: 'satellites' as OverlayKey, label: 'SATELLITES', color: '#00ffff', count: satCount },
    { key: 'earthquakes' as OverlayKey, label: 'QUAKES', color: '#ffaa00', count: quakeCount },
    { key: 'events' as OverlayKey, label: 'NAT EVENTS', color: '#ff6600', count: eventCount },
    { key: 'arcs' as OverlayKey, label: 'CONFLICT ARCS', color: '#ff9966', count: arcCount },
  ].filter(i => overlays[i.key]);

  if (!items.length) return null;

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 150,
      display: 'flex', flexDirection: 'column', gap: 4,
      pointerEvents: 'none',
    }}>
      {items.map(item => (
        <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, boxShadow: `0 0 6px ${item.color}`, flexShrink: 0 }} />
          <span style={{ fontSize: 9, color: item.color, letterSpacing: 2, fontFamily: '"Roboto Mono", monospace' }}>
            {item.label}{item.count != null ? ` (${item.count})` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Point Popup (unified for all layers) ─────────────────────────────────────

function PointPopup({ point, onClose, onSearchIntel }: { point: SelectedPoint; onClose: () => void; onSearchIntel?: (q: string) => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.35)', cursor: 'pointer' }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 420, maxWidth: 'calc(100vw - 32px)',
        background: 'rgba(5,10,15,0.98)',
        border: `1px solid ${point.kind === 'conflict' ? '#ff333366' : point.kind === 'satellite' ? '#00ffff66' : point.kind === 'quake' ? '#ffaa0066' : '#ff660066'}`,
        boxShadow: `0 0 40px rgba(${point.kind === 'conflict' ? '255,51,51' : point.kind === 'satellite' ? '0,255,255' : point.kind === 'quake' ? '255,170,0' : '255,102,0'},0.2)`,
        zIndex: 400, fontFamily: '"Roboto Mono", "Courier New", monospace',
        animation: 'popupIn 0.18s cubic-bezier(0.23,1,0.32,1)',
        backdropFilter: 'blur(16px)',
      }}>
        {point.kind === 'conflict' && <ConflictContent zone={point.data} onClose={onClose} onSearchIntel={onSearchIntel} />}
        {point.kind === 'satellite' && <SatelliteContent sat={point.data} onClose={onClose} />}
        {point.kind === 'quake' && <QuakeContent quake={point.data} onClose={onClose} />}
        {point.kind === 'event' && <NatEventContent event={point.data} onClose={onClose} />}
      </div>
    </>
  );
}

function PopupHeader({ title, badges, color, onClose }: { title: string; badges?: React.ReactNode; color: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: `1px solid ${color}33`, background: `${color}08` }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: 2, marginBottom: 6 }}>{title}</div>
        {badges}
      </div>
      <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #333', color: '#888', width: 26, height: 26, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', flexShrink: 0, marginLeft: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
    </div>
  );
}

function PopupRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '4px 0', borderBottom: '1px solid #ffffff06' }}>
      <span style={{ fontSize: 9, color: '#556', letterSpacing: 2 }}>{label}</span>
      <span style={{ fontSize: 11, color: color || '#ccc', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

function PopupFooter({ lat, lon, note }: { lat: number; lon: number; note?: string }) {
  return (
    <div style={{ padding: '8px 16px', borderTop: '1px solid #ffffff08', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 9, color: '#334', letterSpacing: 1 }}>{note || 'SENTINEL · CLICK BACKDROP TO DISMISS'}</span>
      <span style={{ fontSize: 9, color: '#334' }}>{lat?.toFixed(2)}°{lat >= 0 ? 'N' : 'S'} {Math.abs(lon).toFixed(2)}°{lon >= 0 ? 'E' : 'W'}</span>
    </div>
  );
}

// ── Conflict content ──
function ConflictContent({ zone, onClose, onSearchIntel }: { zone: GdeltGeoPoint; onClose: () => void; onSearchIntel?: (q: string) => void }) {
  const statusColor = (s?: string) => s === 'ACTIVE' ? '#ff3333' : s === 'CRITICAL' ? '#ff0000' : s === 'ELEVATED' ? '#ffaa00' : s === 'MONITORING' ? '#00d4ff' : '#888';
  const goldsteinBar = zone.avgGoldstein != null ? Math.max(0, Math.min(100, ((zone.avgGoldstein + 10) / 20) * 100)) : null;
  const goldsteinColor = zone.avgGoldstein != null ? (zone.avgGoldstein <= -8 ? '#ff0000' : zone.avgGoldstein <= -5 ? '#ff3333' : zone.avgGoldstein <= -2 ? '#ffaa00' : '#00d4ff') : '#888';
  return (
    <>
      <PopupHeader
        title={zone.name?.toUpperCase() || 'CONFLICT ZONE'}
        color="#ff3333"
        onClose={onClose}
        badges={
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {zone.status && <span style={{ fontSize: 9, padding: '2px 8px', letterSpacing: 2, background: `${statusColor(zone.status)}22`, border: `1px solid ${statusColor(zone.status)}66`, color: statusColor(zone.status) }}>{zone.status}</span>}
            {zone.type && <span style={{ fontSize: 9, padding: '2px 8px', letterSpacing: 2, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}>{zone.type.toUpperCase()}</span>}
            {zone.trend && (
              <span style={{ fontSize: 9, padding: '2px 8px', letterSpacing: 2,
                background: zone.trend === 'ESCALATING' ? 'rgba(255,0,0,0.12)' : zone.trend === 'DE-ESCALATING' ? 'rgba(0,255,65,0.1)' : 'rgba(255,170,0,0.1)',
                border: `1px solid ${zone.trend === 'ESCALATING' ? 'rgba(255,0,0,0.4)' : zone.trend === 'DE-ESCALATING' ? 'rgba(0,255,65,0.4)' : 'rgba(255,170,0,0.4)'}`,
                color: zone.trend === 'ESCALATING' ? '#ff4444' : zone.trend === 'DE-ESCALATING' ? '#00ff41' : '#ffaa00',
              }}>
                {zone.trend === 'ESCALATING' ? '↑' : zone.trend === 'DE-ESCALATING' ? '↓' : '→'} {zone.trend}
              </span>
            )}
            {zone.isLive && <span style={{ fontSize: 9, padding: '2px 8px', letterSpacing: 2, background: 'rgba(0,255,100,0.1)', border: '1px solid rgba(0,255,100,0.4)', color: '#00ff64' }}>● LIVE GDELT</span>}
          </div>
        }
      />
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {zone.isLive ? (
          <>
            <PopupRow label="EVENTS (15-MIN WINDOW)" value={String(zone.count || 0)} color="#ff6666" />
            {zone.country && <PopupRow label="COUNTRY CODE" value={zone.country} />}
            {zone.avgGoldstein != null && (
              <div style={{ padding: '4px 0', borderBottom: '1px solid #ffffff06' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: '#556', letterSpacing: 2 }}>GOLDSTEIN CONFLICT SCORE</span>
                  <span style={{ fontSize: 11, color: goldsteinColor }}>{zone.avgGoldstein} / -10</span>
                </div>
                <div style={{ height: 4, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${100 - (goldsteinBar ?? 50)}%`, background: goldsteinColor, borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 8, color: '#334', marginTop: 3, letterSpacing: 1 }}>-10 = MAX CONFLICT · 0 = NEUTRAL · +10 = MAX COOPERATION</div>
              </div>
            )}
            {zone.description && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 9, color: '#556', letterSpacing: 2, marginBottom: 4 }}>GDELT ANALYSIS</div>
                <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.6, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid #ffffff0a' }}>{zone.description}</div>
              </div>
            )}
            {zone.sources && zone.sources.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 9, color: '#556', letterSpacing: 2, marginBottom: 4 }}>SOURCE ARTICLES</div>
                {zone.sources.slice(0, 3).map((src, i) => {
                  let host = src;
                  try { host = new URL(src).hostname.replace('www.', ''); } catch {}
                  return (
                    <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'block', padding: '4px 8px', marginBottom: 3, background: 'rgba(255,51,51,0.05)', border: '1px solid rgba(255,51,51,0.15)', color: '#ff9999', fontSize: 10, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      ↗ {host}
                    </a>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {zone.parties && <PopupRow label="PARTIES" value={zone.parties} />}
            {zone.since && <PopupRow label="SINCE" value={zone.since} />}
            {zone.region && <PopupRow label="REGION" value={zone.region} />}
            {zone.casualties && zone.casualties !== 'N/A' && <PopupRow label="CASUALTIES" value={zone.casualties} color="#ff6666" />}
            {zone.description && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 9, color: '#556', letterSpacing: 2, marginBottom: 4 }}>SITUATION REPORT</div>
                <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.6, padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid #ffffff0a' }}>{zone.description}</div>
              </div>
            )}
          </>
        )}
      </div>
      {zone.name && onSearchIntel && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid #ffffff08' }}>
          <button
            onClick={() => { onSearchIntel(zone.name!); onClose(); }}
            style={{
              width: '100%', padding: '8px 12px',
              background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.3)',
              color: '#ff9999', fontSize: 10, letterSpacing: 2, fontFamily: 'inherit',
              cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
            }}
          >
            🔍 SEARCH INTEL FOR "{zone.name?.toUpperCase()}"
          </button>
        </div>
      )}
      <PopupFooter lat={zone.lat} lon={zone.lon} note={zone.isLive ? 'GDELT 2.0 · 24H AGGREGATED DATA' : 'SENTINEL · STATIC FALLBACK DATA'} />
    </>
  );
}

// ── Satellite content ──
function SatelliteContent({ sat, onClose }: { sat: SatPoint; onClose: () => void }) {
  return (
    <>
      <PopupHeader title={sat.name} color="#00ffff" onClose={onClose}
        badges={<span style={{ fontSize: 9, padding: '2px 8px', letterSpacing: 2, background: 'rgba(0,255,255,0.1)', border: '1px solid rgba(0,255,255,0.3)', color: '#00ffff' }}>LIVE TRACK</span>}
      />
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <PopupRow label="CATALOG ID" value={sat.id} color="#00ffff" />
        <PopupRow label="ALTITUDE" value={sat.alt ? `~${sat.alt} km (${Math.round(sat.alt * 0.621)} mi)` : 'N/A'} />
        <PopupRow label="POSITION" value={`${sat.lat.toFixed(3)}°, ${sat.lon.toFixed(3)}°`} />
        <PopupRow label="DATA SOURCE" value="open-notify.org / ISS" />
        <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(0,255,255,0.04)', border: '1px solid rgba(0,255,255,0.15)', fontSize: 10, color: '#00ffff88' }}>
          Position updates every 10 seconds. ISS orbits at ~17,500 mph completing one orbit every ~92 minutes.
        </div>
      </div>
      <PopupFooter lat={sat.lat} lon={sat.lon} note="SENTINEL SATELLITE TRACKER" />
    </>
  );
}

// ── Earthquake content ──
function QuakeContent({ quake, onClose }: { quake: QuakePoint; onClose: () => void }) {
  const mc = magColor(quake.mag);
  const severity = quake.mag >= 7 ? 'MAJOR' : quake.mag >= 6 ? 'STRONG' : quake.mag >= 5 ? 'MODERATE' : quake.mag >= 4 ? 'LIGHT' : 'MINOR';
  return (
    <>
      <PopupHeader title={`M${quake.mag?.toFixed(1)} EARTHQUAKE`} color={mc} onClose={onClose}
        badges={
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 9, padding: '2px 8px', letterSpacing: 2, background: `${mc}22`, border: `1px solid ${mc}66`, color: mc }}>{severity}</span>
            <span style={{ fontSize: 9, padding: '2px 8px', letterSpacing: 2, background: 'rgba(255,255,255,0.04)', border: '1px solid #333', color: '#888' }}>USGS</span>
          </div>
        }
      />
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <PopupRow label="LOCATION" value={quake.place} />
        <PopupRow label="MAGNITUDE" value={`M${quake.mag?.toFixed(1)}`} color={mc} />
        <PopupRow label="DEPTH" value={`${quake.depth?.toFixed(1)} km (${(quake.depth * 0.621).toFixed(1)} mi)`} />
        <PopupRow label="TIME" value={quake.time ? new Date(quake.time).toLocaleString() : 'N/A'} />
        {quake.url && (
          <a href={quake.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', marginTop: 8, padding: '6px 10px', background: `${mc}11`, border: `1px solid ${mc}33`, color: mc, fontSize: 10, textDecoration: 'none', letterSpacing: 1, textAlign: 'center' }}>
            VIEW ON USGS →
          </a>
        )}
      </div>
      <PopupFooter lat={quake.lat} lon={quake.lon} note="USGS EARTHQUAKE HAZARDS PROGRAM" />
    </>
  );
}

// ── Natural event content ──
function NatEventContent({ event, onClose }: { event: NatEvent; onClose: () => void }) {
  const color = EVENT_COLORS[event.category] || EVENT_COLORS.default;
  return (
    <>
      <PopupHeader title={event.title} color={color} onClose={onClose}
        badges={
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 9, padding: '2px 8px', letterSpacing: 2, background: `${color}22`, border: `1px solid ${color}66`, color }}>{event.category.toUpperCase()}</span>
            <span style={{ fontSize: 9, padding: '2px 8px', letterSpacing: 2, background: 'rgba(255,255,255,0.04)', border: '1px solid #333', color: '#888' }}>NASA EONET</span>
          </div>
        }
      />
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <PopupRow label="EVENT ID" value={event.id} />
        <PopupRow label="CATEGORY" value={event.category} color={color} />
        <PopupRow label="DATE" value={event.date ? new Date(event.date).toLocaleString() : 'N/A'} />
        {event.link && (
          <a href={event.link} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', marginTop: 8, padding: '6px 10px', background: `${color}11`, border: `1px solid ${color}33`, color, fontSize: 10, textDecoration: 'none', letterSpacing: 1, textAlign: 'center' }}>
            VIEW ON NASA EONET →
          </a>
        )}
      </div>
      <PopupFooter lat={event.lat} lon={event.lon} note="NASA EARTH OBSERVATORY NATURAL EVENT TRACKER" />
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusChip({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 14px', borderRight: '1px solid #00ff4122', minWidth: 80 }}>
      <span style={{ fontSize: 9, color: '#556', letterSpacing: 2 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color, letterSpacing: 1 }}>{value}</span>
      <span style={{ fontSize: 9, color: '#556', letterSpacing: 1 }}>{sub}</span>
    </div>
  );
}

function ToolbarBtn({ icon, label, active, onClick, color }: { icon: string; label: string; active: boolean; onClick: () => void; color?: string }) {
  const c = color || '#00ff41';
  return (
    <button onClick={onClick} style={{
      background: active ? `${c}22` : 'transparent',
      border: `1px solid ${active ? `${c}66` : '#222'}`,
      color: active ? c : '#556',
      padding: '4px 12px', borderRadius: 2, cursor: 'pointer',
      fontSize: 10, letterSpacing: 2, fontFamily: 'inherit',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      minWidth: 56, transition: 'all 0.15s',
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function ToolbarSep() {
  return <div style={{ width: 1, height: 32, background: '#00ff4122', margin: '0 4px' }} />;
}

function SidePanel({
  panel, newsItems, markets, kevItems, launches,
  rainviewerTs, rainviewerFrames, radarFrameIdx, onRadarFrameChange,
  precipForecast, weatherOverlay, onToggleWeather, onClose,
  intelQuery, onClearIntelQuery,
}: {
  panel: Panel;
  newsItems: GdeltArticle[];
  markets: MarketItem[];
  kevItems: KevItem[];
  launches: Launch[];
  rainviewerTs: string | null;
  rainviewerFrames: { path: string; time: number }[];
  radarFrameIdx: number;
  onRadarFrameChange: (idx: number) => void;
  precipForecast: { time: string; precip: number }[];
  weatherOverlay: boolean;
  onToggleWeather: () => void;
  onClose: () => void;
  intelQuery?: string | null;
  onClearIntelQuery?: () => void;
}) {
  const filteredNews = intelQuery
    ? newsItems.filter(item => item.title.toLowerCase().includes(intelQuery.toLowerCase()))
    : newsItems;
  const MARKET_LABELS: Record<string, string> = {
    SPY: 'S&P 500', QQQ: 'NASDAQ', '^DJI': 'DOW', 'GC=F': 'GOLD', 'CL=F': 'OIL', 'BTC-USD': 'BTC',
  };

  const titles: Record<string, string> = {
    news: '● INTEL BRIEFINGS',
    markets: '● MARKETS',
    weather: '● WEATHER RADAR',
    cyber: '● CYBER / KEV',
    launches: '● SPACE LAUNCHES',
  };

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 380,
      background: 'rgba(5,10,15,0.97)', borderLeft: '1px solid #00ff4133',
      display: 'flex', flexDirection: 'column', zIndex: 200,
      animation: 'slideIn 0.2s ease-out', backdropFilter: 'blur(12px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #00ff4122' }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: '#00ff41' }}>{titles[panel!]}</span>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #333', color: '#888', width: 24, height: 24, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {panel === 'news' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {intelQuery && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.25)', marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: '#ff9999', letterSpacing: 1 }}>🔍 FILTERING: "{intelQuery.toUpperCase()}" ({filteredNews.length} results)</span>
                <button onClick={onClearIntelQuery} style={{ background: 'transparent', border: '1px solid #ff333344', color: '#ff6666', fontSize: 9, padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1 }}>CLEAR</button>
              </div>
            )}
            {filteredNews.length === 0 && intelQuery && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, color: '#334', fontSize: 10, letterSpacing: 2, flexDirection: 'column', gap: 8 }}>
                <div>NO MATCHING ARTICLES</div>
                <button onClick={onClearIntelQuery} style={{ background: 'transparent', border: '1px solid #334', color: '#556', fontSize: 9, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1 }}>SHOW ALL</button>
              </div>
            )}
            {filteredNews.length === 0 && !intelQuery && <EmptyState />}
            {filteredNews.map((item, i) => (
              <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', padding: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid #ffffff0a', textDecoration: 'none', transition: 'border-color 0.15s' }}>
                <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.4, marginBottom: 4 }}>{item.title}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {item.sourcecountry && <span style={{ fontSize: 9, color: '#00d4ff', letterSpacing: 1 }}>[{item.sourcecountry}]</span>}
                  {item.domain && <span style={{ fontSize: 9, color: '#445' }}>{item.domain}</span>}
                </div>
              </a>
            ))}
          </div>
        )}

        {panel === 'markets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {markets.length === 0 && <EmptyState />}
            {markets.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(0,255,65,0.03)', border: '1px solid #00ff4111' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#00ff41', fontWeight: 700, letterSpacing: 1 }}>{MARKET_LABELS[m.symbol] || m.symbol}</div>
                  <div style={{ fontSize: 9, color: '#445' }}>{m.symbol}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: m.change >= 0 ? '#00ff41' : '#ff3333' }}>
                    {m.price?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 10, color: m.change >= 0 ? '#00ff41' : '#ff3333' }}>
                    {m.change >= 0 ? '+' : ''}{m.change?.toFixed(2)} ({m.change >= 0 ? '+' : ''}{m.changePct?.toFixed(2)}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {panel === 'cyber' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 9, color: '#ff3333', letterSpacing: 2, marginBottom: 4 }}>CISA KNOWN EXPLOITED VULNERABILITIES</div>
            {kevItems.length === 0 && <EmptyState />}
            {kevItems.map((kev, i) => (
              <div key={i} style={{ padding: 10, background: 'rgba(255,51,51,0.04)', border: '1px solid #ff333322' }}>
                <div style={{ fontSize: 11, color: '#ff6666', fontWeight: 700, marginBottom: 4 }}>{kev.cveID}</div>
                <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>{kev.vulnerabilityName}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9, color: '#00d4ff' }}>{kev.vendorProject}</span>
                  <span style={{ fontSize: 9, color: '#556' }}>{kev.product}</span>
                  <span style={{ fontSize: 9, color: '#445' }}>Added: {kev.dateAdded}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {panel === 'launches' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 9, color: '#00d4ff', letterSpacing: 2, marginBottom: 4 }}>UPCOMING SPACE LAUNCHES</div>
            {launches.length === 0 && <EmptyState />}
            {launches.map((launch, i) => (
              <div key={i} style={{ padding: 10, background: 'rgba(0,212,255,0.04)', border: '1px solid #00d4ff22' }}>
                <div style={{ fontSize: 12, color: '#00d4ff', fontWeight: 700, marginBottom: 4 }}>{launch.name}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, background: '#00d4ff22', color: '#00d4ff', padding: '1px 6px', letterSpacing: 1 }}>{launch.status?.name}</span>
                  {launch.rocket?.configuration?.name && <span style={{ fontSize: 9, color: '#556' }}>{launch.rocket.configuration.name}</span>}
                </div>
                <div style={{ fontSize: 10, color: '#888' }}>{launch.launch_service_provider?.name}</div>
                <div style={{ fontSize: 9, color: '#445', marginTop: 4 }}>NET: {new Date(launch.net).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}

        {panel === 'weather' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Radar toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'rgba(0,170,255,0.06)', border: '1px solid #00aaff33' }}>
              <span style={{ fontSize: 10, color: '#00aaff', letterSpacing: 2 }}>PRECIPITATION RADAR</span>
              <button onClick={onToggleWeather} style={{
                background: weatherOverlay ? 'rgba(0,170,255,0.2)' : 'transparent',
                border: `1px solid ${weatherOverlay ? '#00aaff' : '#334'}`,
                color: weatherOverlay ? '#00aaff' : '#556',
                padding: '4px 12px', cursor: 'pointer', fontSize: 9, fontFamily: 'inherit', letterSpacing: 2,
              }}>{weatherOverlay ? '● LIVE' : 'ENABLE'}</button>
            </div>

            {/* Radar frame timeline */}
            {rainviewerFrames.length > 0 && (
              <div>
                <div style={{ fontSize: 9, color: '#556', letterSpacing: 2, marginBottom: 8 }}>RADAR HISTORY — {rainviewerFrames.length} FRAMES</div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {rainviewerFrames.map((frame, i) => {
                    const t = new Date(frame.time * 1000);
                    const label = t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                    return (
                      <button key={i} onClick={() => onRadarFrameChange(i)} style={{
                        background: i === radarFrameIdx ? 'rgba(0,170,255,0.25)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${i === radarFrameIdx ? '#00aaff' : '#222'}`,
                        color: i === radarFrameIdx ? '#00aaff' : '#445',
                        padding: '3px 6px', cursor: 'pointer', fontSize: 9, fontFamily: 'inherit',
                      }}>{label}</button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 12-hour precipitation forecast */}
            {precipForecast.length > 0 && (
              <div>
                <div style={{ fontSize: 9, color: '#556', letterSpacing: 2, marginBottom: 8 }}>12-HOUR PRECIPITATION FORECAST (mm)</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 80 }}>
                  {precipForecast.map((f, i) => {
                    const maxPrecip = Math.max(...precipForecast.map(x => x.precip), 1);
                    const barH = Math.max(4, (f.precip / maxPrecip) * 68);
                    const hour = new Date(f.time).getHours();
                    const isNow = i === 0;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{ fontSize: 8, color: f.precip > 0 ? '#00aaff' : '#334' }}>{f.precip > 0 ? f.precip.toFixed(1) : ''}</div>
                        <div style={{
                          width: '100%', height: barH,
                          background: f.precip > 2 ? '#0066ff' : f.precip > 0.5 ? '#00aaff' : '#223',
                          border: isNow ? '1px solid #00aaff' : '1px solid transparent',
                          transition: 'height 0.3s',
                        }} />
                        <div style={{ fontSize: 8, color: isNow ? '#00aaff' : '#334' }}>{hour}h</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 9, color: '#334', letterSpacing: 1, marginTop: 6 }}>SOURCE: OPEN-METEO · GLOBAL WEATHER API</div>
              </div>
            )}

            {precipForecast.length === 0 && rainviewerFrames.length === 0 && <EmptyState />}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: '#334', fontSize: 11, letterSpacing: 2, animation: 'blink 2s infinite' }}>
      LOADING DATA...
    </div>
  );
}
