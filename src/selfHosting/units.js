/**
 * Display units for the self-hosting fork: aircraft and vessel speed in knots
 * AND km/h side by side, aircraft altitude in metres instead of feet / flight
 * levels. Only the text on screen changes; data keeps its own units.
 *
 * On only with GEV_SELF_HOSTING=1 (server/wharkema/hosting.js), so upstream's
 * formats — and its tests — stay as they are everywhere else. Unit labels go
 * through upstream's translated unit table (src/ui/unitLabels.js).
 */
import { formatQuantity } from '../ui/unitLabels.js';

export const METRIC_DISPLAY = import.meta.env?.GEV_SELF_HOSTING === '1';

export const MPS_TO_KT = 1.94384;
export const KT_TO_KMH = 1.852;
export const FT_TO_M = 0.3048;

/** "486 kts · 900 km/h"; '' when unknown or negative. */
export function formatSpeedKnots(knots) {
  if (!Number.isFinite(knots) || knots < 0) return '';
  return `${formatQuantity(Math.round(knots), 'kts')} · ${formatQuantity(
    Math.round(knots * KT_TO_KMH),
    'km/h',
  )}`;
}

/** Same, from metres per second. */
export function formatSpeedMps(mps) {
  return Number.isFinite(mps) ? formatSpeedKnots(mps * MPS_TO_KT) : '';
}

/** "10668 m"; '' when unknown. */
export function formatAltitudeMetres(metres) {
  if (!Number.isFinite(metres)) return '';
  return formatQuantity(Math.round(metres), 'm');
}

/** Readable altitude-tape interval in metres. */
export function altitudeRulerStepMetres(altitudeM) {
  if (!Number.isFinite(altitudeM)) return 200;
  const altitude = Math.max(0, altitudeM);
  if (altitude < 1500) return 50;
  if (altitude < 4500) return 100;
  return 200;
}

/** Cockpit altitude-tape ticks in metres, shaped like upstream's feet ticks. */
export function altitudeRulerTicksMetres(altitudeM, count = 9) {
  if (!Number.isFinite(altitudeM)) return [];
  const tickCount = Math.max(3, Math.floor(count) | 1);
  const altitude = Math.max(0, altitudeM);
  const step = altitudeRulerStepMetres(altitude);
  const units = altitude / step;
  const anchor = Math.floor(units);
  const half = Math.floor(tickCount / 2);
  return Array.from({ length: tickCount }, (_, index) => {
    const tickUnits = anchor + index - half;
    const slot = tickUnits - units;
    return {
      valueM: Math.max(0, tickUnits * step),
      slot,
      depth: Math.abs(slot),
      major: tickUnits % 2 === 0,
      stepM: step,
    };
  });
}
