import { Router } from 'express';
import AdmZip from 'adm-zip';

const router = Router();

// Helper to proxy a URL and return JSON
async function proxyJson(url: string, res: any) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Sentinel/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      res.status(r.status).json({ error: `Upstream ${r.status}` });
      return;
    }
    const data = await r.json();
    res.json(data);
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
}

// Satellite tile proxy — ESRI World Imagery XYZ tiles
// Proxied server-side to avoid any CORS issues in production
router.get('/tiles/:z/:y/:x', async (req, res) => {
  const { z, y, x } = req.params;
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Sentinel/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) { res.status(r.status).end(); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400'); // cache tiles for 24h
    res.send(buf);
  } catch {
    res.status(502).end();
  }
});

// NOAA Kp index (geomagnetic)
router.get('/kp', async (_req, res) => {
  await proxyJson('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json', res);
});

// NOAA space weather alerts
router.get('/space-alerts', async (_req, res) => {
  await proxyJson('https://services.swpc.noaa.gov/products/alerts.json', res);
});

// News aggregator — multi-source RSS (BBC World + NYT World + BBC Tech)
router.get('/gdelt-news', async (_req, res) => {
  const feeds = [
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'NYT' },
    { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', source: 'BBC Tech' },
  ];
  try {
    const results = await Promise.allSettled(
      feeds.map(async ({ url, source }) => {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Sentinel/1.0' },
          signal: AbortSignal.timeout(6000),
        });
        if (!r.ok) return [];
        const xml = await r.text();
        const items: any[] = [];
        const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
        let match;
        while ((match = itemRegex.exec(xml)) !== null) {
          const block = match[1];
          const title = (/<title[^>]*><!\[CDATA\[(.+?)\]\]><\/title>/.exec(block) ||
                         /<title[^>]*>([^<]+)<\/title>/.exec(block))?.[1]?.trim() || '';
          const link = (/<link>([^<]+)<\/link>/.exec(block) ||
                        /<guid[^>]*>([^<]+)<\/guid>/.exec(block))?.[1]?.trim() || '';
          const pubDate = (/<pubDate>([^<]+)<\/pubDate>/.exec(block))?.[1]?.trim() || '';
          if (title && link) {
            items.push({
              title,
              url: link,
              seendate: pubDate ? new Date(pubDate).toISOString().replace(/[-:]/g, '').replace('T', 'T').replace('.000Z', 'Z') : '',
              sourcecountry: source,
              domain: new URL(link).hostname.replace('www.', ''),
            });
          }
          if (items.length >= 15) break;
        }
        return items;
      })
    );
    const articles = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => (r as PromiseFulfilledResult<any[]>).value)
      .slice(0, 50);
    res.json({ articles });
  } catch (e: any) {
    res.status(502).json({ error: e.message, articles: [] });
  }
});

// ── GDELT live conflict aggregator ──────────────────────────────────────────
// Fetches the latest GDELT 2.0 export (updated every 15 min), filters for
// conflict CAMEO event codes (14-20), clusters by ~3° grid, and returns the
// top 30 hotspots ranked by event count × Goldstein conflict intensity.

interface GdeltHotspot {
  lat: number; lon: number; name: string; country: string;
  count: number; avgGoldstein: number; status: string;
  type: string; sources: string[];
  // 24h trend fields (added by extended aggregator)
  count24h?: number; avgGoldstein24h?: number;
  trend?: 'ESCALATING' | 'DE-ESCALATING' | 'STABLE';
  trendDelta?: number;
  // Arc data: actor pairs for this hotspot
  arcs?: Array<{ lat1: number; lon1: number; lat2: number; lon2: number; goldstein: number }>;
}

let gdeltCache: { data: GdeltHotspot[]; fetchedAt: number } | null = null;
const GDELT_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// 24h extended cache — refreshed every 30 minutes (covers 96 x 15-min files)
interface Gdelt24hResult {
  hotspots: GdeltHotspot[];
  arcs: Array<{ lat1: number; lon1: number; lat2: number; lon2: number; goldstein: number; name: string }>;
  fetchedAt: number;
}
let gdelt24hCache: Gdelt24hResult | null = null;
const GDELT_24H_TTL = 30 * 60 * 1000; // 30 minutes

// Country centroid lookup for arc lines (ISO2 → [lat, lon])
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  US: [38.9, -77.0], RU: [55.7, 37.6], CN: [39.9, 116.4], UA: [50.4, 30.5],
  PS: [31.9, 35.2], IS: [31.8, 35.2], IR: [35.7, 51.4], SY: [33.5, 36.3],
  YM: [15.4, 44.2], SU: [15.6, 32.5], BM: [16.8, 96.2], AF: [34.5, 69.2],
  IQ: [33.3, 44.4], LY: [32.9, 13.2], ML: [12.6, -8.0], SO: [2.0, 45.3],
  ET: [9.0, 38.7], SS: [4.9, 31.6], CD: [-4.3, 15.3], HT: [18.5, -72.3],
  VE: [10.5, -66.9], KN: [39.0, 125.8], TW: [25.0, 121.5], PH: [14.6, 121.0],
  GB: [51.5, -0.1], FR: [48.9, 2.4], DE: [52.5, 13.4], IL: [31.8, 35.2],
  SA: [24.7, 46.7], TR: [39.9, 32.9], PK: [33.7, 73.1], IN: [28.6, 77.2],
  BR: [-15.8, -47.9], MX: [19.4, -99.1], NG: [9.1, 7.2], KE: [-1.3, 36.8],
  ZA: [-25.7, 28.2], EG: [30.1, 31.2], MA: [34.0, -6.8], DZ: [36.7, 3.2],
};

async function parseGdeltFile(url: string): Promise<{
  hotspots: Map<string, { count: number; goldsteinSum: number; lat: number; lon: number; name: string; country: string; sources: string[] }>;
  arcs: Array<{ lat1: number; lon1: number; lat2: number; lon2: number; goldstein: number; name: string }>;
}> {
  const csvResp = await fetch(url, {
    headers: { 'User-Agent': 'Sentinel/1.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!csvResp.ok) throw new Error(`GDELT fetch failed: ${csvResp.status}`);
  const buffer = Buffer.from(await csvResp.arrayBuffer());
  const zip = new AdmZip(buffer);
  const csvText = zip.getEntries()[0].getData().toString('utf-8');

  const conflictCodes = new Set(['14', '15', '17', '18', '19', '20']);
  const hotspots = new Map<string, { count: number; goldsteinSum: number; lat: number; lon: number; name: string; country: string; sources: string[] }>();
  const arcs: Array<{ lat1: number; lon1: number; lat2: number; lon2: number; goldstein: number; name: string }> = [];

  for (const line of csvText.split('\n')) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    if (cols.length < 58) continue;
    const code = (cols[26] || '').substring(0, 2);
    if (!conflictCodes.has(code)) continue;
    try {
      const lat = parseFloat(cols[56]);
      const lon = parseFloat(cols[57]);
      if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) continue;
      const goldstein = parseFloat(cols[30]) || 0;
      const name = cols[52] || '';
      const country = cols[53] || '';
      const source = cols.length > 60 ? (cols[60] || '') : '';
      const gridLat = Math.round(lat / 3) * 3;
      const gridLon = Math.round(lon / 3) * 3;
      const key = `${gridLat},${gridLon}`;
      if (!hotspots.has(key)) hotspots.set(key, { count: 0, goldsteinSum: 0, lat, lon, name, country, sources: [] });
      const h = hotspots.get(key)!;
      h.count++; h.goldsteinSum += goldstein; h.lat = lat; h.lon = lon;
      if (name.length > h.name.length) h.name = name;
      if (country) h.country = country;
      if (source && h.sources.length < 3) h.sources.push(source);

      // Arc: Actor1 country → Actor2 country (cols[7]=Actor1CountryCode, cols[17]=Actor2CountryCode)
      const a1cc = (cols[7] || '').toUpperCase();
      const a2cc = (cols[17] || '').toUpperCase();
      if (a1cc && a2cc && a1cc !== a2cc && COUNTRY_CENTROIDS[a1cc] && COUNTRY_CENTROIDS[a2cc] && goldstein < -3) {
        arcs.push({
          lat1: COUNTRY_CENTROIDS[a1cc][0], lon1: COUNTRY_CENTROIDS[a1cc][1],
          lat2: COUNTRY_CENTROIDS[a2cc][0], lon2: COUNTRY_CENTROIDS[a2cc][1],
          goldstein, name: name || `${a1cc}→${a2cc}`,
        });
      }
    } catch { continue; }
  }
  return { hotspots, arcs };
}

async function fetchGdelt24h(): Promise<Gdelt24hResult> {
  if (gdelt24hCache && Date.now() - gdelt24hCache.fetchedAt < GDELT_24H_TTL) {
    return gdelt24hCache;
  }

  // Get list of last 24h GDELT files from masterfilelist
  const masterResp = await fetch('http://data.gdeltproject.org/gdeltv2/masterfilelist-translation.txt', {
    headers: { 'User-Agent': 'Sentinel/1.0' },
    signal: AbortSignal.timeout(10000),
  });
  // Fall back to lastupdate only if masterfilelist fails
  if (!masterResp.ok) throw new Error('GDELT masterfilelist unavailable');
  const masterText = await masterResp.text();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  // File names encode timestamp: 20240715120000.export.CSV.zip
  const exportUrls = masterText.split('\n')
    .map(l => l.trim().split(' ')[2])
    .filter(u => u && u.endsWith('.export.CSV.zip'))
    .filter(u => {
      const m = u.match(/(\d{14})\.export/);
      if (!m) return false;
      const ts = m[1];
      const d = new Date(`${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}T${ts.slice(8,10)}:${ts.slice(10,12)}:${ts.slice(12,14)}Z`);
      return d.getTime() > cutoff;
    })
    .slice(-8); // max 8 files (2h window) to avoid timeout — still enough for trend scoring

  if (exportUrls.length === 0) throw new Error('No 24h GDELT files found');

  // Fetch files in batches of 6 to avoid memory pressure
  const combined24h = new Map<string, { count: number; goldsteinSum: number; lat: number; lon: number; name: string; country: string; sources: string[]; recentCount: number; recentGoldsteinSum: number }>();
  const allArcs: Array<{ lat1: number; lon1: number; lat2: number; lon2: number; goldstein: number; name: string }> = [];
  const recentCutoff = Date.now() - 60 * 60 * 1000; // last 1 hour

  const BATCH = 6;
  for (let i = 0; i < exportUrls.length; i += BATCH) {
    const batch = exportUrls.slice(i, i + BATCH);
    const isRecent = batch.some(u => {
      const m = u.match(/(\d{14})\.export/);
      if (!m) return false;
      const ts = m[1];
      const d = new Date(`${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}T${ts.slice(8,10)}:${ts.slice(10,12)}:${ts.slice(12,14)}Z`);
      return d.getTime() > recentCutoff;
    });
    const results = await Promise.allSettled(batch.map(u => parseGdeltFile(u)));
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const { hotspots, arcs } = r.value;
      for (const [key, h] of hotspots) {
        if (!combined24h.has(key)) combined24h.set(key, { ...h, recentCount: 0, recentGoldsteinSum: 0 });
        const c = combined24h.get(key)!;
        c.count += h.count; c.goldsteinSum += h.goldsteinSum;
        if (isRecent) { c.recentCount += h.count; c.recentGoldsteinSum += h.goldsteinSum; }
        if (h.name.length > c.name.length) c.name = h.name;
        if (h.country) c.country = h.country;
        for (const s of h.sources) if (!c.sources.includes(s) && c.sources.length < 3) c.sources.push(s);
      }
      // Only keep arcs from recent files to avoid clutter
      if (isRecent) allArcs.push(...arcs.slice(0, 20));
    }
  }

  const sorted = Array.from(combined24h.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  const hotspots: GdeltHotspot[] = sorted.map(h => {
    const avgG = h.goldsteinSum / Math.max(1, h.count);
    const recentAvgG = h.recentCount > 0 ? h.recentGoldsteinSum / h.recentCount : avgG;
    const trendDelta = recentAvgG - avgG;
    const trend: GdeltHotspot['trend'] = trendDelta < -0.5 ? 'ESCALATING' : trendDelta > 0.5 ? 'DE-ESCALATING' : 'STABLE';
    const status = avgG <= -8 ? 'CRITICAL' : avgG <= -5 ? 'ACTIVE' : avgG <= -2 ? 'ELEVATED' : 'MONITORING';
    const cc = h.country;
    const type = (cc === 'IS' || cc === 'PS') ? 'Armed Conflict' :
                 (cc === 'IR' || cc === 'SY' || cc === 'YM') ? 'Military Conflict' :
                 (cc === 'UP') ? 'War' : 'Conflict/Unrest';
    return {
      lat: h.lat, lon: h.lon, name: h.name || cc, country: cc,
      count: h.count, avgGoldstein: Math.round(avgG * 10) / 10,
      status, type, sources: h.sources,
      count24h: h.count, avgGoldstein24h: Math.round(avgG * 10) / 10,
      trend, trendDelta: Math.round(trendDelta * 10) / 10,
    };
  });

  // Deduplicate arcs: keep unique actor pairs, max 50
  const arcSeen = new Set<string>();
  const dedupedArcs = allArcs.filter(a => {
    const k = `${Math.round(a.lat1)},${Math.round(a.lon1)}-${Math.round(a.lat2)},${Math.round(a.lon2)}`;
    if (arcSeen.has(k)) return false;
    arcSeen.add(k); return true;
  }).slice(0, 50);

  gdelt24hCache = { hotspots, arcs: dedupedArcs, fetchedAt: Date.now() };
  return gdelt24hCache;
}

// Static fallback zones shown when GDELT fetch fails
const FALLBACK_ZONES: GdeltHotspot[] = [
  { lat: 49.0, lon: 32.0, name: 'Ukraine', country: 'UP', count: 10, avgGoldstein: -9.5, status: 'ACTIVE', type: 'Armed Conflict', sources: [] },
  { lat: 31.5, lon: 34.5, name: 'Gaza', country: 'PS', count: 8, avgGoldstein: -9.2, status: 'ACTIVE', type: 'Armed Conflict', sources: [] },
  { lat: 15.6, lon: 32.5, name: 'Sudan', country: 'SU', count: 6, avgGoldstein: -8.8, status: 'ACTIVE', type: 'Civil War', sources: [] },
  { lat: 19.7, lon: 96.1, name: 'Myanmar', country: 'BM', count: 5, avgGoldstein: -7.5, status: 'ACTIVE', type: 'Civil War', sources: [] },
  { lat: 15.5, lon: 48.5, name: 'Yemen', country: 'YM', count: 5, avgGoldstein: -8.0, status: 'ACTIVE', type: 'Civil War', sources: [] },
];

async function fetchGdeltConflicts(): Promise<GdeltHotspot[]> {
  if (gdeltCache && Date.now() - gdeltCache.fetchedAt < GDELT_CACHE_TTL) {
    return gdeltCache.data;
  }

  // Get the latest file URL from GDELT lastupdate
  const lastUpdateResp = await fetch('http://data.gdeltproject.org/gdeltv2/lastupdate.txt', {
    headers: { 'User-Agent': 'Sentinel/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!lastUpdateResp.ok) throw new Error('GDELT lastupdate fetch failed');
  const lastUpdateText = await lastUpdateResp.text();
  const exportUrl = lastUpdateText.split('\n')
    .map(l => l.trim().split(' ')[2])
    .find(u => u && u.endsWith('.export.CSV.zip'));
  if (!exportUrl) throw new Error('No GDELT export URL found');

  // Download and unzip the CSV
  const csvResp = await fetch(exportUrl, {
    headers: { 'User-Agent': 'Sentinel/1.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!csvResp.ok) throw new Error(`GDELT CSV fetch failed: ${csvResp.status}`);
  const buffer = Buffer.from(await csvResp.arrayBuffer());

  const zip = new AdmZip(buffer);
  const csvText = zip.getEntries()[0].getData().toString('utf-8');

  // CAMEO conflict codes: 14=Protest, 15=Exhibit force, 17=Coerce, 18=Assault, 19=Fight, 20=Military force
  const conflictCodes = new Set(['14', '15', '17', '18', '19', '20']);
  const hotspots = new Map<string, {
    count: number; goldsteinSum: number; lat: number; lon: number;
    name: string; country: string; sources: string[];
  }>();

  for (const line of csvText.split('\n')) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    if (cols.length < 58) continue;
    const code = (cols[26] || '').substring(0, 2);
    if (!conflictCodes.has(code)) continue;
    try {
      const lat = parseFloat(cols[56]);
      const lon = parseFloat(cols[57]);
      if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) continue;
      const goldstein = parseFloat(cols[30]) || 0;
      const name = cols[52] || '';
      const country = cols[53] || '';
      const source = cols.length > 60 ? (cols[60] || '') : '';
      // Cluster by ~3-degree grid
      const gridLat = Math.round(lat / 3) * 3;
      const gridLon = Math.round(lon / 3) * 3;
      const key = `${gridLat},${gridLon}`;
      if (!hotspots.has(key)) {
        hotspots.set(key, { count: 0, goldsteinSum: 0, lat, lon, name, country, sources: [] });
      }
      const h = hotspots.get(key)!;
      h.count++;
      h.goldsteinSum += goldstein;
      h.lat = lat;
      h.lon = lon;
      if (name.length > h.name.length) h.name = name;
      if (country) h.country = country;
      if (source && h.sources.length < 3) h.sources.push(source);
    } catch { continue; }
  }

  const sorted = Array.from(hotspots.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  const data: GdeltHotspot[] = sorted.map(h => {
    const avgG = h.goldsteinSum / Math.max(1, h.count);
    const status = avgG <= -8 ? 'CRITICAL' : avgG <= -5 ? 'ACTIVE' : avgG <= -2 ? 'ELEVATED' : 'MONITORING';
    const cc = h.country;
    const type = (cc === 'IS' || cc === 'PS') ? 'Armed Conflict' :
                 (cc === 'IR' || cc === 'SY' || cc === 'YM') ? 'Military Conflict' :
                 (cc === 'UP') ? 'War' : 'Conflict/Unrest';
    return {
      lat: h.lat, lon: h.lon,
      name: h.name || cc,
      country: cc,
      count: h.count,
      avgGoldstein: Math.round(avgG * 10) / 10,
      status,
      type,
      sources: h.sources,
    };
  });

  gdeltCache = { data, fetchedAt: Date.now() };
  return data;
}

router.get('/gdelt-geo', async (_req, res) => {
  let hotspots: GdeltHotspot[];
  let isLive = true;
  try {
    hotspots = await fetchGdeltConflicts();
  } catch (e: any) {
    console.error('[GDELT] Error fetching live data, using fallback:', e.message);
    hotspots = FALLBACK_ZONES;
    isLive = false;
  }

  const features = hotspots.map(h => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
    properties: {
      name: h.name,
      count: h.count,
      type: h.type,
      status: h.status,
      avgGoldstein: h.avgGoldstein,
      country: h.country,
      sources: h.sources,
      isLive,
      // Legacy popup-compatible fields
      parties: isLive
        ? `${h.count} GDELT conflict events (15-min window)`
        : 'See description',
      since: isLive ? 'Live GDELT data' : 'Static fallback',
      description: isLive
        ? `${h.count} conflict-coded events detected in this area in the latest 15-minute GDELT window. Goldstein conflict intensity score: ${h.avgGoldstein} (scale -10 to +10, more negative = more conflict). Top sources: ${h.sources.slice(0, 2).map(s => { try { return new URL(s).hostname.replace('www.', ''); } catch { return s.substring(0, 30); } }).join(', ') || 'GDELT 2.0'}.`
        : `Active conflict zone (static data — GDELT unavailable).`,
      casualties: isLive ? `Goldstein score: ${h.avgGoldstein}` : 'N/A',
      region: h.country,
    },
  }));

  res.json({ type: 'FeatureCollection', features, isLive, fetchedAt: gdeltCache?.fetchedAt || null });
});

// GDELT 24h aggregated conflict hotspots with trend scoring
router.get('/gdelt-24h', async (_req, res) => {
  try {
    const result = await fetchGdelt24h();
    const features = result.hotspots.map(h => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
      properties: {
        name: h.name, count: h.count, count24h: h.count24h,
        avgGoldstein: h.avgGoldstein, avgGoldstein24h: h.avgGoldstein24h,
        status: h.status, type: h.type, country: h.country,
        sources: h.sources, trend: h.trend, trendDelta: h.trendDelta,
        isLive: true,
        parties: `${h.count} GDELT events (24h)`,
        since: 'Live GDELT 24h data',
        description: `${h.count} conflict events in the past 24 hours. Avg Goldstein: ${h.avgGoldstein}. Trend: ${h.trend} (${h.trendDelta && h.trendDelta > 0 ? '+' : ''}${h.trendDelta}).`,
        casualties: `Goldstein: ${h.avgGoldstein}`,
        region: h.country,
      },
    }));
    res.json({ type: 'FeatureCollection', features, arcs: result.arcs, isLive: true, fetchedAt: result.fetchedAt });
  } catch (e: any) {
    console.error('[GDELT-24h] Error:', e.message);
    res.status(502).json({ error: e.message, features: [], arcs: [] });
  }
});

// OpenSky military flights (US military ICAO hex ranges)
router.get('/mil-flights', async (_req, res) => {
  try {
    const r = await fetch('https://opensky-network.org/api/states/all', {
      headers: { 'User-Agent': 'Sentinel/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) {
      res.status(r.status).json({ error: `OpenSky ${r.status}`, states: [] });
      return;
    }
    const data = (await r.json()) as { states?: any[][] };
    const military = (data.states || []).filter((s: any[]) => {
      const icao = (s[0] || '').toLowerCase();
      return (
        (icao >= 'ae0000' && icao <= 'afffff') ||
        (icao >= '43c000' && icao <= '43cfff')
      );
    });
    res.json({ count: military.length, states: military.slice(0, 200) });
  } catch (e: any) {
    res.status(502).json({ error: e.message, count: 0, states: [] });
  }
});

// Yahoo Finance market data
router.get('/markets', async (_req, res) => {
  const symbols = ['SPY', 'QQQ', '%5EDJI', 'GC%3DF', 'CL%3DF', 'BTC-USD'];
  try {
    const results = await Promise.allSettled(
      symbols.map(async (sym) => {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
          }
        );
        if (!r.ok) return null;
        const d = (await r.json()) as any;
        const meta = d?.chart?.result?.[0]?.meta;
        if (!meta) return null;
        return {
          symbol: meta.symbol,
          price: meta.regularMarketPrice,
          change: meta.regularMarketPrice - meta.previousClose,
          changePct: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
          currency: meta.currency,
        };
      })
    );
    const markets = results
      .filter((r) => r.status === 'fulfilled' && r.value)
      .map((r) => (r as PromiseFulfilledResult<any>).value);
    res.json({ markets });
  } catch (e: any) {
    res.status(502).json({ error: e.message, markets: [] });
  }
});

// CISA KEV (cyber vulnerabilities)
router.get('/cisa-kev', async (_req, res) => {
  try {
    const r = await fetch(
      'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
      { headers: { 'User-Agent': 'Sentinel/1.0' }, signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) {
      res.status(r.status).json({ error: `CISA ${r.status}`, vulnerabilities: [] });
      return;
    }
    const data = (await r.json()) as { vulnerabilities?: any[] };
    const sorted = (data.vulnerabilities || [])
      .sort((a: any, b: any) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
      .slice(0, 50);
    res.json({ count: data.vulnerabilities?.length || 0, vulnerabilities: sorted });
  } catch (e: any) {
    res.status(502).json({ error: e.message, vulnerabilities: [] });
  }
});

// Space launches (The Space Devs Launch Library 2)
router.get('/launches', async (_req, res) => {
  await proxyJson(
    'https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=10&format=json',
    res
  );
});

// RainViewer timestamps for weather radar
router.get('/rainviewer', async (_req, res) => {
  await proxyJson('https://api.rainviewer.com/public/weather-maps.json', res);
});

// Natural Earth GeoJSON boundaries — proxied with long-term caching
const geoJsonCache: Map<string, { data: any; ts: number }> = new Map();
const GEOJSON_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function fetchGeoJson(url: string): Promise<any> {
  const cached = geoJsonCache.get(url);
  if (cached && Date.now() - cached.ts < GEOJSON_TTL) return cached.data;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`GeoJSON fetch failed: ${r.status}`);
  const data = await r.json();
  geoJsonCache.set(url, { data, ts: Date.now() });
  return data;
}

router.get('/boundaries/countries', async (_req, res) => {
  try {
    const data = await fetchGeoJson(
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
    );
    res.set('Cache-Control', 'public, max-age=86400');
    res.json(data);
  } catch (e: any) { res.status(502).json({ error: e.message }); }
});

router.get('/boundaries/states', async (_req, res) => {
  try {
    const data = await fetchGeoJson(
      'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_1_states_provinces.geojson'
    );
    res.set('Cache-Control', 'public, max-age=86400');
    res.json(data);
  } catch (e: any) { res.status(502).json({ error: e.message }); }
});

// NASA night-lights tile proxy (GIBS)
router.get('/night-tiles/:z/:x/:y', async (req, res) => {
  const { z, x, y } = req.params;
  // NASA GIBS VIIRS Night Lights
  const url = `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/VIIRS_Black_Marble_NightLights_3Band_2016/default/2016-01-01/500m/${z}/${y}/${x}.jpg`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Sentinel/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) { res.status(r.status).end(); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch { res.status(502).end(); }
});

// RainViewer tile proxy — avoid CORS issues in production
router.get('/radar-tiles/:path(*)', async (req, res) => {
  const path = req.params.path;
  const url = `https://tilecache.rainviewer.com/${path}`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Sentinel/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) { res.status(r.status).end(); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(buf);
  } catch { res.status(502).end(); }
});

// Open-Meteo 12-hour precipitation forecast for a given lat/lon
router.get('/precip-forecast', async (req, res) => {
  const lat = parseFloat(String(req.query.lat)) || 40.7;
  const lon = parseFloat(String(req.query.lon)) || -74.0;
  try {
    // Fetch 2 days to guarantee 12 hours even near midnight
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation,precipitation_probability&forecast_days=2&timezone=UTC`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) { res.status(r.status).json({ error: 'upstream' }); return; }
    const d = await r.json() as any;
    const nowIso = new Date().toISOString().slice(0, 13); // 'YYYY-MM-DDTHH'
    const times: string[] = d.hourly?.time || [];
    const precip: number[] = d.hourly?.precipitation || [];
    const prob: number[] = d.hourly?.precipitation_probability || [];
    // Find the index of the current hour
    const startIdx = times.findIndex((t: string) => t.startsWith(nowIso));
    const from = startIdx >= 0 ? startIdx : 0;
    res.json({
      times: times.slice(from, from + 12),
      precipitation: precip.slice(from, from + 12),
      probability: prob.slice(from, from + 12),
    });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

// ISS live position (open-notify.org)
router.get('/iss', async (_req, res) => {
  try {
    const r = await fetch('http://api.open-notify.org/iss-now.json', {
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) { res.status(r.status).json({ error: 'upstream' }); return; }
    const d = await r.json() as any;
    res.json({
      lat: parseFloat(d.iss_position.latitude),
      lon: parseFloat(d.iss_position.longitude),
      timestamp: d.timestamp,
    });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

// USGS Earthquakes (M2.5+ past 24h)
router.get('/earthquakes', async (_req, res) => {
  try {
    const r = await fetch(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
      { headers: { 'User-Agent': 'Sentinel/1.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) { res.status(r.status).json({ error: 'upstream', features: [] }); return; }
    const d = await r.json() as any;
    const features = (d.features || []).map((f: any) => ({
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      depth: f.geometry.coordinates[2],
      mag: f.properties.mag,
      place: f.properties.place,
      time: f.properties.time,
      url: f.properties.url,
      type: f.properties.type,
    }));
    res.json({ count: features.length, features });
  } catch (e: any) {
    res.status(502).json({ error: e.message, features: [] });
  }
});

// NASA EONET — natural events (wildfires, storms, volcanoes)
router.get('/natural-events', async (_req, res) => {
  try {
    const r = await fetch(
      'https://eonet.gsfc.nasa.gov/api/v3/events?limit=50&status=open',
      { headers: { 'User-Agent': 'Sentinel/1.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) { res.status(r.status).json({ error: 'upstream', events: [] }); return; }
    const d = await r.json() as any;
    const events = (d.events || []).map((e: any) => {
      const geom = e.geometry?.[e.geometry.length - 1];
      if (!geom?.coordinates) return null;
      const [lon, lat] = geom.coordinates;
      return {
        id: e.id,
        title: e.title,
        category: e.categories?.[0]?.title || 'Event',
        categoryId: e.categories?.[0]?.id || '',
        lat, lon,
        date: geom.date,
        link: e.link,
      };
    }).filter(Boolean);
    res.json({ count: events.length, events });
  } catch (e: any) {
    res.status(502).json({ error: e.message, events: [] });
  }
});

export default router;
