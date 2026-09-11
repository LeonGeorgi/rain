export type MapBounds = [number, number, number, number];
export const mapWidth = 640;
export const mapHeight = 540;
const padding = 48;

function mercatorY(latitude: number) {
  return Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)) * 180 / Math.PI;
}

export function projectMapPoint(longitude: number, latitude: number, bounds: MapBounds) {
  const [west, south, east, north] = bounds;
  const top = mercatorY(north);
  const bottom = mercatorY(south);
  const scale = Math.min((mapWidth - 2 * padding) / (east - west), (mapHeight - 2 * padding) / (top - bottom));
  return {
    x: (mapWidth - (east - west) * scale) / 2 + (longitude - west) * scale,
    y: (mapHeight - (top - bottom) * scale) / 2 + (top - mercatorY(latitude)) * scale,
  };
}
