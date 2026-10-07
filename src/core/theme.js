import * as THREE from 'three';
import { lerp } from './util.js';

// Two looks for one city. Everything theme-dependent is blended by `n` ∈ [0 day, 1 night].
export const PALETTE = {
  day: {
    skyTop: '#2c6cb8',
    skyHorizon: '#c6d9e8',
    skyBottom: '#a9b4bb',
    glow: '#000000',
    fog: '#c6d9e8',
    fogDensity: 0.00085,
    lightColor: '#fff0d8',
    lightIntensity: 4.0,
    hemiSky: '#d8e8ff',
    hemiGround: '#81796b',
    hemiIntensity: 2.3,
    cloud: '#ffffff',
    cloudShadow: '#9fb0c2',
    cloudCover: 0.42,
    exposure: 1.0,
    bloomStrength: 0.2,
    bloomThreshold: 0.95,
    bloomRadius: 0.35,
    envIntensity: 1.0,
    groundRough: 1.0,
  },
  night: {
    skyTop: '#01030a',
    skyHorizon: '#141b29',
    skyBottom: '#06080d',
    glow: '#45291a',
    fog: '#0e141e',
    fogDensity: 0.0017,
    lightColor: '#93a9ff',
    lightIntensity: 0.55,
    hemiSky: '#2a3854',
    hemiGround: '#0c0b0d',
    hemiIntensity: 0.62,
    cloud: '#3b302c',
    cloudShadow: '#0b0c10',
    cloudCover: 0.5,
    exposure: 1.08,
    bloomStrength: 0.62,
    bloomThreshold: 0.78,
    bloomRadius: 0.5,
    envIntensity: 0.75,
    groundRough: 0.62,
  },
};

const SUN_DIR = new THREE.Vector3(0.55, 0.62, 0.48).normalize();
const MOON_DIR = new THREE.Vector3(-0.42, 0.5, -0.76).normalize();

const colorCache = {};
const C = (hex) => (colorCache[hex] ||= new THREE.Color(hex));

// Returns a fresh blended palette (colours as THREE.Color in linear space).
export function blendPalette(n, out = {}) {
  const d = PALETTE.day;
  const k = PALETTE.night;
  for (const key of Object.keys(d)) {
    const a = d[key];
    const b = k[key];
    if (typeof a === 'string') {
      out[key] ||= new THREE.Color();
      out[key].copy(C(a)).lerp(C(b), n);
    } else out[key] = lerp(a, b, n);
  }
  out.lightDir ||= new THREE.Vector3();
  out.lightDir.copy(SUN_DIR).lerp(MOON_DIR, n).normalize();
  out.sunDir = SUN_DIR;
  out.moonDir = MOON_DIR;
  out.n = n;
  return out;
}
