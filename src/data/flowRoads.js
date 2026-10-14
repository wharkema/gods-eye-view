/**
 * @file Road geometry from TomTom flow tiles, for the traffic layer's live mode.
 *
 * Live mode used to draw dots on OSM roads from the public Overpass API and
 * colour them with TomTom flow. The public Overpass servers now refuse or time
 * out for some hosts (HTTP 406 from overpass-api.de, timeouts from the mirrors),
 * which left the layer empty at "0% cov". TomTom's flow tiles already carry the
 * road polylines, so live mode builds its roads from them: no Overpass needed,
 * and every road has flow by construction.
 *
 * The output is shaped like an Overpass `out geom` response, so it runs through
 * the same `parseRoads` as Overpass data (sub-sampling, waypoints, terrain).
 *
 * @module data/flowRoads
 */

/** TomTom `road_type` → OSM `highway` class (drives dot density per road type). */
const ROAD_TYPE_TO_HIGHWAY = {
  Motorway: 'motorway',
  'International road': 'trunk',
  'Major road': 'primary',
  'Secondary road': 'secondary',
  'Connecting road': 'tertiary',
  'Major local road': 'residential',
  'Local road': 'residential',
  'Minor local road': 'unclassified',
};

/**
 * Whether any vertex of a polyline lies inside the bounds.
 * @param {number[][]} coords - [[lon, lat], …]
 * @param {{south:number, west:number, north:number, east:number}} b
 */
function touchesBounds(coords, b) {
  for (const [lon, lat] of coords) {
    if (lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east) return true;
  }
  return false;
}

/**
 * Turn decoded flow segments into an Overpass-shaped payload.
 *
 * A flow tile (z12, ~10 km) is much larger than the clamped view box, so only
 * segments with a vertex inside `bounds` are kept — the dot budget is spent on
 * what the camera sees.
 *
 * @param {Array<{coords:number[][], roadType:string}>} segments - From `fetchFlowForBounds`.
 * @param {{south:number, west:number, north:number, east:number}} bounds - Clamped view box.
 * @returns {{elements: Array<{type:'way', geometry:Array<{lat:number, lon:number}>, tags:{highway:string}}>}}
 */
export function flowSegmentsToOverpass(segments, bounds) {
  const elements = [];
  for (const segment of Array.isArray(segments) ? segments : []) {
    const coords = segment?.coords;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    if (bounds && !touchesBounds(coords, bounds)) continue;
    elements.push({
      type: 'way',
      geometry: coords.map(([lon, lat]) => ({ lat, lon })),
      tags: { highway: ROAD_TYPE_TO_HIGHWAY[segment.roadType] || 'unclassified' },
    });
  }
  return { elements };
}
