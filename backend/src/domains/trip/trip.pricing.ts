import { config } from '../../core/config.js';

/**
 * Haversine formula — straight-line distance between two lat/lon points (km).
 * Uses Earth radius 6371 km.
 */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate trip fare in XAF.
 * Formula: straight-line × road-factor × per-km-rate + base, rounded up to nearest 100 XAF.
 * All rate constants come from config (env-overridable).
 */
export function estimateFareXaf(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number
): number {
  const straightLineKm = haversineKm(originLat, originLon, destLat, destLon);
  const roadKm = straightLineKm * config.TRIP_ROAD_DISTANCE_FACTOR;
  return Math.max(
    config.TRIP_BASE_FARE_XAF,
    Math.ceil((config.TRIP_BASE_FARE_XAF + roadKm * config.TRIP_PER_KM_RATE_XAF) / 100) * 100
  );
}
