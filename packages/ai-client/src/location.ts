import { AiClientError } from './errors.js';

export interface PublicLocation {
  label: string;
  coarseLat: number;
  coarseLng: number;
  area?: string;
}

export interface PreciseLocation {
  lat: number;
  lng: number;
  accuracyM?: number;
  label?: string;
  area?: string;
}

export interface SeparatedLocation {
  publicLocation: PublicLocation;
  /** Private: keep off-chain, never serialize beside the public location. */
  privateLocation: { lat: number; lng: number; accuracyM?: number };
}

function assertCoordinate(lat: number, lng: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new AiClientError('LOCATION_INVALID', 'latitude must be -90..90');
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new AiClientError('LOCATION_INVALID', 'longitude must be -180..180');
  }
}

function roundTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

/**
 * Coarse public location. Default 2 decimal places is roughly 1 km; the exact
 * coordinate is never included in the returned object.
 */
export function toPublicLocation(precise: PreciseLocation, decimals = 2): PublicLocation {
  assertCoordinate(precise.lat, precise.lng);
  if (!Number.isInteger(decimals) || decimals < 1 || decimals > 5) {
    throw new AiClientError('LOCATION_INVALID', 'coordinate precision must be 1..5 decimals');
  }
  return {
    label: precise.label ?? precise.area ?? 'Approximate location',
    coarseLat: roundTo(precise.lat, decimals),
    coarseLng: roundTo(precise.lng, decimals),
    ...(precise.area ? { area: precise.area } : {}),
  };
}

/** Split precise coordinates into a public coarse view and a private record. */
export function splitLocation(precise: PreciseLocation, decimals = 2): SeparatedLocation {
  assertCoordinate(precise.lat, precise.lng);
  return {
    publicLocation: toPublicLocation(precise, decimals),
    privateLocation: {
      lat: precise.lat,
      lng: precise.lng,
      ...(precise.accuracyM !== undefined ? { accuracyM: precise.accuracyM } : {}),
    },
  };
}
