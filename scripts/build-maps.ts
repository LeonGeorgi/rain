import { readFile, writeFile } from 'node:fs/promises';
import { projectMapPoint, type MapBounds } from '../src/lib/country-map.ts';

// Input: Natural Earth ne_50m_admin_0_countries.geojson. Only the two supported
// countries are retained; geography and station markers share one projection.
const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/build-maps.ts path/to/ne_50m_admin_0_countries.geojson');
const collection = JSON.parse(await readFile(file, 'utf8')) as {
  features: { properties: { ADM0_A3: string }; geometry: { type: string; coordinates: number[][][][] } }[];
};
const outlines: Record<string, {bounds: MapBounds; path: string}> = {};
for (const [provider, code] of [['jma', 'JPN'], ['dwd', 'DEU']]) {
  const feature = collection.features.find(feature => feature.properties.ADM0_A3 === code);
  if (!feature || feature.geometry.type !== 'MultiPolygon') throw new Error(`Missing MultiPolygon for ${code}.`);
  const rings = feature.geometry.coordinates.flat();
  const points = rings.flat();
  if (!points.length || points.some(point => point.length < 2 || !point.every(Number.isFinite))) throw new Error(`Invalid coordinates for ${code}.`);
  const bounds: MapBounds = [Math.min(...points.map(p=>p[0])), Math.min(...points.map(p=>p[1])), Math.max(...points.map(p=>p[0])), Math.max(...points.map(p=>p[1]))];
  const path = rings.map(ring => ring.map(([longitude, latitude], index) => {
    const {x, y} = projectMapPoint(longitude, latitude, bounds);
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join('') + 'Z').join('');
  outlines[provider] = {bounds, path};
}
await writeFile(new URL('../src/assets/maps/country-outlines.json', import.meta.url), JSON.stringify(outlines) + '\n');
