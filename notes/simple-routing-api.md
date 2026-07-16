# Simple Routing API Notes

Source: https://api.simplerouting.io/api/docs/

## Key Info
- API Key: stored in SIMPLE_ROUTING_API_KEY env var
- Auth: `Authorization: Bearer <token>`
- Coverage: North America & Europe
- Free tier: 100 requests/day

## OSRM Directions Endpoint
```
GET https://api.simplerouting.io/osrm/route/v1/{profile}/{lon1,lat1;lon2,lat2}
  ?overview=full&steps=true&geometries=geojson
```
- profile: `driving` | `walking` | `cycling`
- Coordinates are [longitude, latitude] order
- Returns: routes[].geometry.coordinates (GeoJSON LineString), routes[].legs[].steps[]

## Example
```bash
curl "https://api.simplerouting.io/osrm/route/v1/driving/-73.9935,40.7506;-73.7781,40.6413?overview=full&steps=true&geometries=geojson" \
  -H "Authorization: Bearer 4e98c31a-233f-4cc7-8e06-0ef583e943fb"
```

## VROOM Fleet Optimization
```
POST https://api.simplerouting.io/vroom/
```

## Nominatim Geocoding (free, no key)
```
GET https://nominatim.openstreetmap.org/search?format=json&q={query}&limit=5
```
- Returns: [{lat, lon, display_name}]
- Note: coordinates are lat/lon (opposite of OSRM)
