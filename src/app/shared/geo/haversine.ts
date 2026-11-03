import { HALF } from '@core/config/units';

const SQUARE = 2;
/** Diameter in radii. */
const DIAMETER = 2;
const DEGREES_PER_PI = 180;
/** Haversine — great-circle distance between two WGS-84 points. */
export class Haversine {
  /** Haversine formula — distance in km between two WGS-84 points. */
  public static haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat * HALF) ** SQUARE +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng * HALF) ** SQUARE;
    return R * DIAMETER * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}


function toRad(deg: number): number {
  return (deg * Math.PI) / DEGREES_PER_PI;
}
