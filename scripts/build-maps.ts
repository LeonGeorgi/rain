import { readFile, writeFile } from 'node:fs/promises';
import { countries } from '../src/lib/stations.ts';
import { projectMapPoint, type MapBounds } from '../src/lib/country-map.ts';

// Input: Natural Earth ne_50m_admin_0_countries.geojson. Only the supported
// countries are retained; geography and station markers share one projection.
const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/build-maps.ts path/to/ne_50m_admin_0_countries.geojson');
const collection = JSON.parse(await readFile(file, 'utf8')) as {
  features: { properties: { ADM0_A3: string }; geometry: { type: string; coordinates: number[][][][] } }[];
};
const outlines: Record<string, {bounds: MapBounds; path: string}> = {};
for (const {id, mapCode:code} of countries) {
  const feature = collection.features.find(feature => feature.properties.ADM0_A3 === code);
  if (!feature || feature.geometry.type !== 'MultiPolygon') throw new Error(`Missing MultiPolygon for ${code}.`);
  // The US view covers the contiguous states where the selected stations are.
  const polygons = feature.geometry.coordinates.filter(polygon => {
    if (id === 'us') return polygon[0].every(([lon, lat]) => lon >= -130 && lon <= -60 && lat >= 24 && lat <= 50);
    if (id === 'fr') return polygon[0].every(([lon, lat]) => lon >= -6 && lon <= 10 && lat >= 41 && lat <= 52);
    if (id === 'nl') return polygon[0].every(([lon, lat]) => lon >= 3 && lon <= 8 && lat >= 50 && lat <= 54);
    if (id === 'au') return polygon[0].every(([lon, lat]) => lon >= 112 && lon <= 154 && lat >= -44 && lat <= -10);
    return true;
  });
  const rings = polygons.flat();
  const points = rings.flat();
  if (!points.length || points.some(point => point.length < 2 || !point.every(Number.isFinite))) throw new Error(`Invalid coordinates for ${code}.`);
  const bounds: MapBounds = [Math.min(...points.map(p=>p[0])), Math.min(...points.map(p=>p[1])), Math.max(...points.map(p=>p[0])), Math.max(...points.map(p=>p[1]))];
  const path = rings.map(ring => ring.map(([longitude, latitude], index) => {
    const {x, y} = projectMapPoint(longitude, latitude, bounds);
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join('') + 'Z').join('');
  outlines[id] = {bounds, path};
}
await writeFile(new URL('../src/assets/maps/country-outlines.json', import.meta.url), JSON.stringify(outlines) + '\n');
