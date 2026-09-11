import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { projectMapPoint, mapWidth, mapHeight, type MapBounds } from '../src/lib/country-map.ts';
import { stations } from '../src/lib/stations.ts';

const maps=JSON.parse(await readFile(new URL('../src/assets/maps/country-outlines.json',import.meta.url),'utf8')) as Record<string,{bounds:MapBounds;path:string}>;

test('country projection preserves east/west and north/south orientation and keeps stations within their country extent',()=>{
  for(const station of stations){
    const {bounds,path}=maps[station.country];
    const [west,south,east,north]=bounds;
    assert.ok(station.longitude>=west&&station.longitude<=east,station.name);
    assert.ok(station.latitude>=south&&station.latitude<=north,station.name);
    const point=projectMapPoint(station.longitude,station.latitude,bounds);
    assert.ok(point.x>0&&point.x<mapWidth&&point.y>0&&point.y<mapHeight,station.name);
    assert.ok(projectMapPoint(station.longitude+0.1,station.latitude,bounds).x>point.x);
    assert.ok(projectMapPoint(station.longitude,station.latitude+0.1,bounds).y<point.y);
    assert.match(path,/^M/);
    assert.ok(!path.includes('NaN'));
  }
});

test('Japan includes Okinawa and separates the nearby Kyoto and Osaka station coordinates',()=>{
  const position=(id:string)=>{const station=stations.find(station=>station.id===id)!;return projectMapPoint(station.longitude,station.latitude,maps.jp.bounds);};
  assert.ok(position('47936').y>position('47807').y);
  assert.ok(position('47759').y<position('47772').y);
  assert.ok(position('47759').x>position('47772').x);
});
