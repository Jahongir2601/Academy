// Quyosh holati — NOAA soddalashtirilgan algoritmi (aniqlik ~0.5°, maket uchun yetarli).
import * as THREE from 'three';
import { SITE } from '../data/campus';

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTHS_UZ = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

export function dayOfYear(month: number, day: number): number {
  let n = day;
  for (let m = 0; m < month - 1; m++) n += MONTH_DAYS[m];
  return n;
}

export function dateFromDayOfYear(doy: number): { month: number; day: number } {
  let d = doy;
  for (let m = 0; m < 12; m++) {
    if (d <= MONTH_DAYS[m]) return { month: m + 1, day: d };
    d -= MONTH_DAYS[m];
  }
  return { month: 12, day: 31 };
}

export function formatDate(doy: number): string {
  const { month, day } = dateFromDayOfYear(doy);
  return `${day}-${MONTHS_UZ[month - 1]}`;
}

export function formatTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const hh = m === 60 ? h + 1 : h;
  const mm = m === 60 ? 0 : m;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export interface SunState {
  /** Balandlik, gradus (ufqdan yuqori). */
  altitude: number;
  /** Azimut, gradus (shimoldan soat yo‘nalishida). */
  azimuth: number;
  /** Quyosh tomonga birlik vektor (sahna koordinatalarida). */
  dir: THREE.Vector3;
}

const RAD = Math.PI / 180;

export function sunPosition(doy: number, localHours: number, lat = SITE.lat, lon = SITE.lon, tz = SITE.utcOffset): SunState {
  const g = ((2 * Math.PI) / 365) * (doy - 1 + (localHours - 12) / 24);
  const eqTime =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const timeOffset = eqTime + 4 * lon - 60 * tz;
  const tst = localHours * 60 + timeOffset;
  const ha = (tst / 4 - 180) * RAD;
  const phi = lat * RAD;

  const cosZen = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
  const zen = Math.acos(Math.min(1, Math.max(-1, cosZen)));
  const altitude = 90 - zen / RAD;
  const azSouth = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi));
  const azimuth = (azSouth / RAD + 180 + 360) % 360;

  const alt = altitude * RAD;
  const az = azimuth * RAD;
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
  return { altitude, azimuth, dir };
}

/** Quyosh chiqishi va botishi (soat, mahalliy vaqt) — ikkilik qidiruv bilan. */
export function sunriseSunset(doy: number): { rise: number; set: number } {
  const find = (a: number, b: number, rising: boolean) => {
    let lo = a;
    let hi = b;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      const up = sunPosition(doy, mid).altitude > -0.833;
      if (up === rising) hi = mid;
      else lo = mid;
    }
    return (lo + hi) / 2;
  };
  return { rise: find(0, 12, true), set: find(12, 24, false) };
}
