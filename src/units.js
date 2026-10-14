/**
 * Display units shared by every aircraft and vessel readout.
 *
 * Speeds read in knots and km/h side by side ("486 kts · 900 km/h");
 * aircraft altitude reads in metres. Source data stays in its own units
 * (m/s for flights, knots for AIS, metres or feet for altitude) — only the
 * text on screen changes.
 */

export const MPS_TO_KT = 1.94384;
export const KT_TO_KMH = 1.852;
export const FT_TO_M = 0.3048;

/** Whole knots and km/h: "486 kts · 900 km/h"; '' when unknown. */
export function formatSpeedKt(knots) {
  if (!Number.isFinite(knots) || knots < 0) return '';
  return `${Math.round(knots)} kts · ${Math.round(knots * KT_TO_KMH)} km/h`;
}

/** Same, from metres per second. */
export function formatSpeedMps(mps) {
  return Number.isFinite(mps) ? formatSpeedKt(mps * MPS_TO_KT) : '';
}

/** Whole metres with a thin thousands separator: "10 668 m"; '' when unknown. */
export function formatAltitudeM(metres) {
  if (!Number.isFinite(metres)) return '';
  const rounded = Math.round(metres);
  return `${String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} m`;
}
