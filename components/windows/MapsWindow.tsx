/**
 * MapsWindow — multi-layer map with turn-by-turn directions
 *
 * Layers:
 *   • OpenStreetMap  (Leaflet)
 *   • OpenTopoMap    (Leaflet)
 *   • Esri Satellite (Leaflet)
 *   • Google Maps    (Map.tsx proxy)
 *
 * Features:
 *   • Location search (Nominatim)
 *   • My Location geolocation
 *   • Directions panel (Simple Routing API via tRPC)
 *   • Route polyline drawn on Leaflet layers
 *   • Turn-by-turn steps list
 */
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { MapView } from "@/components/Map";
import { trpc } from "@/lib/trpc";

// ── Inject Leaflet CSS once ────────────────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("leaflet-css")) {
  const link = document.createElement("link");
  link.id = "leaflet-css";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}

// ── Tile layer definitions ─────────────────────────────────────────────────────
type LayerId = "osm" | "topo" | "esri" | "google";

interface TileLayerDef {
  id: LayerId;
  label: string;
  fullName: string;
  icon: string;
  url?: string;
  attribution?: string;
  maxZoom?: number;
}

const TILE_LAYERS: TileLayerDef[] = [
  {
    id: "osm",
    label: "Street",
    fullName: "OpenStreetMap",
    icon: "🗺",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  {
    id: "topo",
    label: "Topo",
    fullName: "OpenTopoMap",
    icon: "⛰",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
  },
  {
    id: "esri",
    label: "Satellite",
    fullName: "Esri World Imagery",
    icon: "🛰",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 18,
  },
  {
    id: "google",
    label: "Google",
    fullName: "Google Maps",
    icon: "📍",
    url: undefined,
  },
];

// ── Profile icons ──────────────────────────────────────────────────────────────
const PROFILE_ICONS: Record<string, string> = {
  driving: "🚗",
  walking: "🚶",
  cycling: "🚴",
};

// ── LeafletMap ─────────────────────────────────────────────────────────────────
interface LeafletMapProps {
  tileLayer: TileLayerDef;
  center: [number, number];
  zoom: number;
  routeGeoJSON?: { type: string; coordinates: [number, number][] } | null;
  originMarker?: [number, number] | null;
  destMarker?: [number, number] | null;
  onCenterChange: (center: [number, number], zoom: number) => void;
}

function LeafletMap({
  tileLayer,
  center,
  zoom,
  routeGeoJSON,
  originMarker,
  destMarker,
  onCenterChange,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const tileRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const originMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current) return;
    import("leaflet").then((L) => {
      if (mapRef.current) return;

      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        center,
        zoom,
        zoomControl: false,
      });
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapRef.current = map;

      if (tileLayer.url) {
        tileRef.current = L.tileLayer(tileLayer.url, {
          attribution: tileLayer.attribution,
          maxZoom: tileLayer.maxZoom ?? 18,
        }).addTo(map);
      }

      map.on("moveend", () => {
        const c = map.getCenter();
        onCenterChange([c.lat, c.lng], map.getZoom());
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        tileRef.current = null;
        routeLayerRef.current = null;
        originMarkerRef.current = null;
        destMarkerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap tile layer
  useEffect(() => {
    if (!mapRef.current || !tileLayer.url) return;
    import("leaflet").then((L) => {
      if (tileRef.current) mapRef.current.removeLayer(tileRef.current);
      tileRef.current = L.tileLayer(tileLayer.url!, {
        attribution: tileLayer.attribution,
        maxZoom: tileLayer.maxZoom ?? 18,
      }).addTo(mapRef.current);
    });
  }, [tileLayer]);

  // Fly to centre when changed externally
  const prevCenter = useRef(center);
  useEffect(() => {
    if (!mapRef.current) return;
    if (prevCenter.current[0] !== center[0] || prevCenter.current[1] !== center[1]) {
      mapRef.current.flyTo(center, zoom, { duration: 1 });
      prevCenter.current = center;
    }
  }, [center, zoom]);

  // Draw route polyline
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      // Remove old route
      if (routeLayerRef.current) {
        mapRef.current.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
      if (!routeGeoJSON) return;

      // GeoJSON coords are [lon, lat]; Leaflet uses [lat, lon]
      const latLngs = routeGeoJSON.coordinates.map(
        ([lon, lat]: [number, number]) => [lat, lon] as [number, number]
      );
      routeLayerRef.current = L.polyline(latLngs, {
        color: "#00d4ff",
        weight: 4,
        opacity: 0.85,
        dashArray: undefined,
      }).addTo(mapRef.current);

      // Fit map to route bounds
      mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [30, 30] });
    });
  }, [routeGeoJSON]);

  // Origin marker
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      if (originMarkerRef.current) {
        mapRef.current.removeLayer(originMarkerRef.current);
        originMarkerRef.current = null;
      }
      if (!originMarker) return;
      const greenIcon = L.divIcon({
        html: '<div style="width:12px;height:12px;border-radius:50%;background:#00ff88;border:2px solid #fff;box-shadow:0 0 6px #00ff88;"></div>',
        className: "",
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      originMarkerRef.current = L.marker(originMarker, { icon: greenIcon })
        .addTo(mapRef.current)
        .bindPopup("Origin");
    });
  }, [originMarker]);

  // Destination marker
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      if (destMarkerRef.current) {
        mapRef.current.removeLayer(destMarkerRef.current);
        destMarkerRef.current = null;
      }
      if (!destMarker) return;
      const redIcon = L.divIcon({
        html: '<div style="width:12px;height:12px;border-radius:50%;background:#ff4444;border:2px solid #fff;box-shadow:0 0 6px #ff4444;"></div>',
        className: "",
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      destMarkerRef.current = L.marker(destMarker, { icon: redIcon })
        .addTo(mapRef.current)
        .bindPopup("Destination");
    });
  }, [destMarker]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", background: "#0a1628" }}
    />
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  root: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    background: "#020c1b",
    overflow: "hidden",
    fontFamily: "'Courier New', monospace",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "7px 10px",
    borderBottom: "1px solid rgba(0,212,255,0.15)",
    background: "rgba(2,12,27,0.97)",
    flexShrink: 0,
    flexWrap: "wrap" as const,
  },
  input: {
    padding: "5px 10px",
    background: "rgba(0,50,100,0.35)",
    border: "1px solid rgba(0,212,255,0.25)",
    borderRadius: "4px",
    color: "#00d4ff",
    fontSize: "12px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  btn: (active?: boolean) => ({
    padding: "5px 10px",
    background: active ? "rgba(0,212,255,0.25)" : "rgba(0,50,100,0.3)",
    border: `1px solid ${active ? "#00d4ff" : "rgba(0,212,255,0.2)"}`,
    borderRadius: "4px",
    color: active ? "#00d4ff" : "rgba(0,212,255,0.6)",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: active ? 700 : 400,
    transition: "all 0.15s",
    flexShrink: 0,
  } as React.CSSProperties),
  iconBtn: {
    padding: "5px 8px",
    background: "rgba(0,50,100,0.3)",
    border: "1px solid rgba(0,212,255,0.2)",
    borderRadius: "4px",
    color: "#00d4ff",
    cursor: "pointer",
    fontSize: "14px",
    flexShrink: 0,
  } as React.CSSProperties,
};

// ── Main MapsWindow ────────────────────────────────────────────────────────────
interface MapsWindowProps {
  /** Route data injected by SENTINEL brain when directions are given */
  data?: {
    origin?: string;
    destination?: string;
    profile?: string;
    originCoords?: { lat: number; lng: number };
    destCoords?: { lat: number; lng: number };
  };
}

export function MapsWindow({ data }: MapsWindowProps = {}) {
  // Map state
  const [activeLayer, setActiveLayer] = useState<LayerId>("osm");
  const [center, setCenter] = useState<[number, number]>([40.7128, -74.006]);
  const [zoom, setZoom] = useState(12);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ lat: string; lon: string; display_name: string }>
  >([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  // Directions state — pre-filled from SENTINEL route data if available
  const [showDirections, setShowDirections] = useState(() => !!(data?.origin && data?.destination));
  const [originInput, setOriginInput] = useState(() => data?.origin ?? "");
  const [destInput, setDestInput] = useState(() => data?.destination ?? "");
  const [profile, setProfile] = useState<"driving" | "walking" | "cycling">(
    () => (data?.profile as "driving" | "walking" | "cycling") ?? "driving"
  );
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(
    () => data?.originCoords ?? null
  );
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(
    () => data?.destCoords ?? null
  );
  const [geocodingField, setGeocodingField] = useState<"origin" | "dest" | null>(null);
  const [routeGeoJSON, setRouteGeoJSON] = useState<{ type: string; coordinates: [number, number][] } | null>(null);
  const [routeSteps, setRouteSteps] = useState<Array<{
    instruction: string;
    distance: string;
    duration: string;
    maneuverType: string;
    maneuverModifier?: string | null;
  }>>([])
  const [routeSummary, setRouteSummary] = useState<{ distance: string; duration: string } | null>(null);
  const [directionsError, setDirectionsError] = useState<string | null>(null);

  // Google Maps refs
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMarkerRef = useRef<any>(null);
  const googleRouteRef = useRef<any>(null);

  const currentTile = TILE_LAYERS.find((l) => l.id === activeLayer)!;

  // ── tRPC queries ─────────────────────────────────────────────────────────────
  const { data: mapsConfig } = trpc.maps.isConfigured.useQuery();

  // Directions query — only fires when both coords are set
  const directionsQuery = trpc.maps.getDirections.useQuery(
    {
      origin: originCoords ?? { lat: 0, lng: 0 },
      destination: destCoords ?? { lat: 0, lng: 0 },
      profile,
    },
    {
      enabled: !!(originCoords && destCoords),
      retry: false,
    }
  );

  // Handle directions result
  useEffect(() => {
    if (directionsQuery.data) {
      setRouteGeoJSON(directionsQuery.data.geometry as any);
      setRouteSteps(directionsQuery.data.steps);
      setRouteSummary({
        distance: directionsQuery.data.totalDistance,
        duration: directionsQuery.data.totalDuration,
      });
      setDirectionsError(null);
    }
    if (directionsQuery.error) {
      setDirectionsError(directionsQuery.error.message);
      setRouteGeoJSON(null);
      setRouteSteps([]);
      setRouteSummary(null);
    }
  }, [directionsQuery.data, directionsQuery.error]);

  // ── Geocode an address field ──────────────────────────────────────────────────
  const geocodeField = useCallback(
    async (value: string, field: "origin" | "dest") => {
      if (!value.trim()) return;
      setGeocodingField(field);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=1`;
        const res = await fetch(url, {
          headers: { "Accept-Language": "en", "User-Agent": "SENTINEL/1.0" },
        });
        const results = await res.json();
        if (results.length) {
          const coords = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
          if (field === "origin") {
            setOriginCoords(coords);
            setOriginInput(results[0].display_name.split(",")[0]);
          } else {
            setDestCoords(coords);
            setDestInput(results[0].display_name.split(",")[0]);
          }
        }
      } finally {
        setGeocodingField(null);
      }
    },
    []
  );

  // ── Search (location search) ──────────────────────────────────────────────────
  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;

      if (activeLayer === "google") {
        if (googleMapRef.current) {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ address: searchQuery }, (results, status) => {
            if (status === "OK" && results && results[0]) {
              const loc = results[0].geometry.location;
              googleMapRef.current!.panTo(loc);
              googleMapRef.current!.setZoom(14);
              if (googleMarkerRef.current) googleMarkerRef.current.map = null;
              googleMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
                map: googleMapRef.current!,
                position: loc,
                title: results[0].formatted_address,
              });
            }
          });
        }
        return;
      }

      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`;
        const res = await fetch(url, { headers: { "Accept-Language": "en" } });
        setSearchResults(await res.json());
      } finally {
        setSearching(false);
      }
    },
    [searchQuery, activeLayer]
  );

  const handleResultClick = useCallback(
    (r: { lat: string; lon: string; display_name: string }) => {
      setCenter([parseFloat(r.lat), parseFloat(r.lon)]);
      setZoom(14);
      setSearchResults([]);
      setSearchQuery(r.display_name.split(",")[0]);
    },
    []
  );

  // ── Geolocation ───────────────────────────────────────────────────────────────
  const handleGeolocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setCenter(c);
        setZoom(15);
        if (activeLayer === "google" && googleMapRef.current) {
          googleMapRef.current.panTo({ lat: c[0], lng: c[1] });
          googleMapRef.current.setZoom(15);
        }
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 10000 }
    );
  }, [activeLayer]);

  // ── Google Maps ready ─────────────────────────────────────────────────────────
  const handleGoogleMapReady = useCallback((map: google.maps.Map) => {
    googleMapRef.current = map;
    map.setCenter({ lat: center[0], lng: center[1] });
    map.setZoom(zoom);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clear directions ──────────────────────────────────────────────────────────
  const clearDirections = useCallback(() => {
    setOriginCoords(null);
    setDestCoords(null);
    setOriginInput("");
    setDestInput("");
    setRouteGeoJSON(null);
    setRouteSteps([]);
    setRouteSummary(null);
    setDirectionsError(null);
  }, []);

  // ── Maneuver icon ─────────────────────────────────────────────────────────────
  function maneuverIcon(type: string, modifier?: string | null): string {
    if (type === "depart") return "🟢";
    if (type === "arrive") return "🔴";
    if (type === "roundabout" || type === "rotary") return "🔄";
    if (modifier === "left" || modifier === "sharp left") return "⬅";
    if (modifier === "right" || modifier === "sharp right") return "➡";
    if (modifier === "slight left") return "↖";
    if (modifier === "slight right") return "↗";
    if (modifier === "uturn") return "↩";
    return "⬆";
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div style={S.toolbar}>
        {/* Search form */}
        <form
          onSubmit={handleSearch}
          style={{ flex: 1, minWidth: "140px", position: "relative" }}
        >
          <input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value) setSearchResults([]);
            }}
            placeholder="Search location…"
            style={S.input}
          />
          <button
            type="submit"
            disabled={searching}
            style={{
              position: "absolute",
              right: "6px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#00d4ff",
              fontSize: "13px",
              padding: 0,
            }}
          >
            {searching ? "⟳" : "🔍"}
          </button>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 9999,
                background: "rgba(2,12,27,0.98)",
                border: "1px solid rgba(0,212,255,0.3)",
                borderRadius: "4px",
                marginTop: "2px",
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {searchResults.map((r, i) => (
                <div
                  key={i}
                  onClick={() => handleResultClick(r)}
                  style={{
                    padding: "7px 10px",
                    cursor: "pointer",
                    color: "#00d4ff",
                    fontSize: "11px",
                    borderBottom: "1px solid rgba(0,212,255,0.08)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(0,212,255,0.1)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  {r.display_name}
                </div>
              ))}
            </div>
          )}
        </form>

        {/* My Location */}
        <button
          onClick={handleGeolocate}
          title="My location"
          style={S.iconBtn}
        >
          {locating ? "⟳" : "📌"}
        </button>

        {/* Directions toggle */}
        <button
          onClick={() => setShowDirections((v) => !v)}
          title="Directions"
          style={S.btn(showDirections)}
        >
          ↗ Directions
        </button>

        {/* Layer switcher */}
        <div style={{ display: "flex", gap: "3px", flexShrink: 0 }}>
          {TILE_LAYERS.map((layer) => (
            <button
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              title={layer.fullName}
              style={S.btn(activeLayer === layer.id)}
            >
              {layer.icon}
            </button>
          ))}
        </div>
      </div>

      {/* ── Directions panel ─────────────────────────────────────────────────── */}
      {showDirections && (
        <div
          style={{
            padding: "10px",
            borderBottom: "1px solid rgba(0,212,255,0.15)",
            background: "rgba(0,20,50,0.6)",
            flexShrink: 0,
          }}
        >
          {/* Profile selector */}
          <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
            {(["driving", "walking", "cycling"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProfile(p)}
                style={S.btn(profile === p)}
              >
                {PROFILE_ICONS[p]} {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Origin / Destination inputs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ position: "relative" }}>
              <input
                value={originInput}
                onChange={(e) => setOriginInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && geocodeField(originInput, "origin")}
                placeholder="From: address or place…"
                style={{ ...S.input, paddingRight: "32px" }}
              />
              <button
                onClick={() => geocodeField(originInput, "origin")}
                disabled={geocodingField === "origin"}
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: originCoords ? "#00ff88" : "#00d4ff",
                  fontSize: "13px",
                  padding: 0,
                }}
              >
                {geocodingField === "origin" ? "⟳" : originCoords ? "✓" : "⏎"}
              </button>
            </div>

            <div style={{ position: "relative" }}>
              <input
                value={destInput}
                onChange={(e) => setDestInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && geocodeField(destInput, "dest")}
                placeholder="To: address or place…"
                style={{ ...S.input, paddingRight: "32px" }}
              />
              <button
                onClick={() => geocodeField(destInput, "dest")}
                disabled={geocodingField === "dest"}
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: destCoords ? "#00ff88" : "#00d4ff",
                  fontSize: "13px",
                  padding: 0,
                }}
              >
                {geocodingField === "dest" ? "⟳" : destCoords ? "✓" : "⏎"}
              </button>
            </div>
          </div>

          {/* Route summary */}
          {directionsQuery.isFetching && (
            <div style={{ color: "rgba(0,212,255,0.6)", fontSize: "11px", marginTop: "8px" }}>
              ⟳ Calculating route…
            </div>
          )}
          {directionsError && (
            <div style={{ color: "#ff4444", fontSize: "11px", marginTop: "8px" }}>
              ⚠ {directionsError}
            </div>
          )}
          {!mapsConfig?.simpleRouting && (
            <div style={{ color: "rgba(255,200,0,0.8)", fontSize: "11px", marginTop: "6px" }}>
              ⚠ Simple Routing API key not configured — directions unavailable
            </div>
          )}
          {routeSummary && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "8px",
                padding: "6px 10px",
                background: "rgba(0,212,255,0.08)",
                border: "1px solid rgba(0,212,255,0.2)",
                borderRadius: "4px",
              }}
            >
              <span style={{ color: "#00d4ff", fontSize: "13px", fontWeight: 700 }}>
                🕐 {routeSummary.duration}
              </span>
              <span style={{ color: "rgba(0,212,255,0.7)", fontSize: "12px" }}>
                📏 {routeSummary.distance}
              </span>
              <button
                onClick={clearDirections}
                style={{ ...S.iconBtn, padding: "2px 6px", fontSize: "11px" }}
              >
                ✕ Clear
              </button>
            </div>
          )}

          {/* Turn-by-turn steps */}
          {routeSteps.length > 0 && (
            <div
              style={{
                marginTop: "8px",
                maxHeight: "180px",
                overflowY: "auto",
                border: "1px solid rgba(0,212,255,0.15)",
                borderRadius: "4px",
              }}
            >
              {routeSteps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    padding: "6px 8px",
                    borderBottom:
                      i < routeSteps.length - 1
                        ? "1px solid rgba(0,212,255,0.08)"
                        : "none",
                    background: i % 2 === 0 ? "transparent" : "rgba(0,212,255,0.03)",
                  }}
                >
                  <span style={{ fontSize: "14px", flexShrink: 0, marginTop: "1px" }}>
                    {maneuverIcon(step.maneuverType, step.maneuverModifier)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#00d4ff", fontSize: "11px", lineHeight: 1.4 }}>
                      {step.instruction}
                    </div>
                    <div style={{ color: "rgba(0,212,255,0.5)", fontSize: "10px", marginTop: "2px" }}>
                      {step.distance} · {step.duration}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Layer label strip ─────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "2px 10px",
          background: "rgba(0,212,255,0.04)",
          borderBottom: "1px solid rgba(0,212,255,0.07)",
          color: "rgba(0,212,255,0.45)",
          fontSize: "10px",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          flexShrink: 0,
        }}
      >
        {currentTile.icon} {currentTile.fullName}
        {activeLayer !== "google" && " · © OpenStreetMap contributors"}
        {activeLayer === "google" && " · © Google"}
      </div>

      {/* ── Map area ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

        {/* Leaflet layers */}
        {activeLayer !== "google" && (
          <div style={{ position: "absolute", inset: 0 }}>
            <LeafletMap
              key={activeLayer}
              tileLayer={currentTile}
              center={center}
              zoom={zoom}
              routeGeoJSON={routeGeoJSON}
              originMarker={originCoords ? [originCoords.lat, originCoords.lng] : null}
              destMarker={destCoords ? [destCoords.lat, destCoords.lng] : null}
              onCenterChange={(c, z) => {
                setCenter(c);
                setZoom(z);
              }}
            />
          </div>
        )}

        {/* Google Maps layer */}
        {activeLayer === "google" && (
          <div style={{ position: "absolute", inset: 0 }}>
            <MapView
              initialCenter={{ lat: center[0], lng: center[1] }}
              initialZoom={zoom}
              onMapReady={handleGoogleMapReady}
            />
          </div>
        )}

        {/* HUD corner brackets */}
        {(["tl", "tr", "bl", "br"] as const).map((pos) => (
          <div
            key={pos}
            style={{
              position: "absolute",
              ...(pos.includes("t") ? { top: 6 } : { bottom: 6 }),
              ...(pos.includes("l") ? { left: 6 } : { right: 6 }),
              width: 12,
              height: 12,
              borderTop: pos.includes("t") ? "2px solid rgba(0,212,255,0.35)" : "none",
              borderBottom: pos.includes("b") ? "2px solid rgba(0,212,255,0.35)" : "none",
              borderLeft: pos.includes("l") ? "2px solid rgba(0,212,255,0.35)" : "none",
              borderRight: pos.includes("r") ? "2px solid rgba(0,212,255,0.35)" : "none",
              pointerEvents: "none",
              zIndex: 500,
            }}
          />
        ))}

        {/* Coordinates HUD */}
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(2,12,27,0.7)",
            border: "1px solid rgba(0,212,255,0.2)",
            borderRadius: "4px",
            padding: "2px 8px",
            color: "rgba(0,212,255,0.55)",
            fontSize: "10px",
            fontFamily: "monospace",
            pointerEvents: "none",
            zIndex: 500,
            whiteSpace: "nowrap",
          }}
        >
          {center[0].toFixed(4)}°, {center[1].toFixed(4)}°
        </div>
      </div>
    </div>
  );
}
