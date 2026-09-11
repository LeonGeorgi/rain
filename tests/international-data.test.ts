import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { fetchGHCN, parseGHCN } from '../scripts/ghcn.ts';
import { parseKNMI, parseKNMIArchive } from '../scripts/knmi.ts';
import { fillDays, splitDailyArchive } from '../scripts/dataset.ts';
import { dateBounds, updateData } from '../scripts/update-data.ts';
import { validateDataset, usableRow, type Row } from '../src/lib/datasets.ts';
import { stations } from '../src/lib/stations.ts';
import { analyze } from '../src/lib/rain.ts';

const us = stations.find(station => station.sourceId === 'USW00094728')!;
const nl = stations.find(station => station.sourceId === '260')!;
const monthly = (values: [number, string][], month = '202402', element = 'PRCP') =>
  us.sourceId + month + element + Array.from({length:31}, (_, i) => {
    const [value, flags] = values[i] ?? [-9999, '   '];
    return String(value).padStart(5) + flags;
  }).join('');
const dutch = (rows: string) => `Source: KNMI\n# STN,YYYYMMDD,RH\n${rows}`;

test('GHCN preserves tenths, traces, missing values and raw flags without accepting failed checks or presumed zeros', () => {
  const rows = parseGHCN(monthly([[125,'  W'],[0,'T W'],[-9999,'   '],[0,'P 0'],[300,' SX'],[21,'B S'],[12,'D S']]), us.sourceId);
  assert.equal(rows.length,29);
  assert.deepEqual(rows.slice(0,5), [['2024-02-01',12.5,1,'  W'],['2024-02-02',0,2,'T W'],['2024-02-03',null,0,'   '],['2024-02-04',0,0,'P 0'],['2024-02-05',30,0,' SX']]);
  assert.deepEqual(rows.slice(0,7).map(row=>usableRow(row,'ghcn')), [true,true,false,false,false,true,true]);
  assert.equal(usableRow(['2024-01-01',0,8],'ghcn'),false);
  assert.throws(()=>parseGHCN(monthly([[1,'T W']]),us.sourceId));
});

test('GHCN rejects malformed stations, dates, flags, duplicates and impossible days, and ignores other elements', () => {
  const record=monthly([[10,'  W']]);
  for(const bad of [record.slice(1), record.replace(us.sourceId,'USW00000000'),record.replace('202402','202413'),monthly([[1,' ?W']]),record+'\n'+record]) {
    assert.throws(()=>parseGHCN(bad,us.sourceId));
  }
  const impossible=Array.from({length:30},():[number,string]=>[0,'  W']);
  assert.throws(()=>parseGHCN(monthly(impossible),us.sourceId));
  assert.equal(parseGHCN(monthly([[100,'  W']],'202402','TMAX')+'\n'+record,us.sourceId)[0][1],1);
  assert.throws(()=>parseGHCN(monthly([[100,'  W']],'202402','MDPR'),us.sourceId));
});

test('GHCN recovers from temporary transport and server failures, but bounds retries and rejects permanent or malformed responses', async () => {
  const station={...us,historyStart:'2024-12-01'};
  const now=new Date('2025-01-03T12:00:00Z');
  const bounds=dateBounds(now,station.timeZone);
  const archive=monthly(Array.from({length:31},():[number,string]=>[10,'  W']),'202412')+'\n'+monthly([[20,'  W']],'202501');
  let calls=0;
  const recovered=await fetchGHCN(station,bounds,now,async()=>{
    calls++;
    if(calls===1) throw new TypeError('Connection closed');
    if(calls===2) return new Response('Unavailable',{status:503});
    return new Response(archive);
  });
  assert.equal(calls,3);
  assert.equal(recovered.current.rows[0][1],2);
  calls=0;
  await assert.rejects(fetchGHCN(station,bounds,now,async()=>{calls++;throw new TypeError('Offline');}),/Offline/);
  assert.equal(calls,3);
  for(const response of [new Response('Missing',{status:404}),new Response('Malformed archive')]){
    calls=0;
    await assert.rejects(fetchGHCN(station,bounds,now,async()=>{calls++;return response;}));
    assert.equal(calls,1);
  }
});

test('KNMI distinguishes traces from missing and true zero and validates the station and complete CSV structure', () => {
  const text=dutch('260,20240101,15\n260,20240102,-1\n260,20240103,\n260,20240104,0');
  assert.deepEqual(parseKNMI(text,'260'),[['2024-01-01',1.5,1],['2024-01-02',0,2],['2024-01-03',null,0],['2024-01-04',0,1]]);
  assert.deepEqual(parseKNMIArchive(zipSync({'etmgeg_260.txt':strToU8(text)}),'260'),parseKNMI(text,'260'));
  assert.throws(()=>parseKNMIArchive(zipSync({'etmgeg_235.txt':strToU8(text)}),'260'));
  for(const row of ['235,20240101,10','260,20240230,10','260,20240101,-2','260,20240101,abc','260,20240101','260,20240101,1\n260,20240101,2']) {
    assert.throws(()=>parseKNMI(dutch(row),'260'));
  }
});

test('international archives preserve leap sums, current cutoffs and gaps; quality flags participate in revisions', () => {
  const station={...us,historyStart:'2024-01-01'};
  const rows: Row[]=fillDays([], '2024-01-01','2025-01-03').map(([date])=>[date,1,1,'  W']);
  rows.at(-2)![1]=null; rows.at(-2)![2]=0;
  const now=new Date('2025-01-06T12:00:00Z');
  const data=splitDailyArchive(station,rows,dateBounds(now,station.timeZone),now,'https://example.com/station.dly');
  validateDataset(data.history,station.id);
  assert.equal(data.current.to,'2025-01-03');
  const analysis=analyze(data.history.rows,data.current.rows,'all','cumulative','ghcn');
  assert.equal(analysis.series[0].values.at(-1),366);
  assert.equal(analysis.lastDate,'2025-01-01');
  assert.equal(analysis.gap,true);
  const changed=structuredClone(rows); changed[0][3]='  X';
  assert.notEqual(splitDailyArchive(station,changed,dateBounds(now,station.timeZone),now,'https://example.com/station.dly').history.revision,data.history.revision);
  const invalid=structuredClone(data.history); invalid.rows[0][3]=' SX';
  assert.throws(()=>validateDataset(invalid,station.id));
  assert.throws(()=>splitDailyArchive(station,[],dateBounds(now),now,''));
  assert.throws(()=>splitDailyArchive(station,rows.slice(1),dateBounds(now),now,''));
  const january=splitDailyArchive(station,rows,dateBounds(new Date('2025-01-01T12:00:00Z'),station.timeZone),now,'');
  assert.deepEqual(january.current.rows,[]);
  assert.equal(dateBounds(new Date('2026-12-31T16:00:00Z'),'Australia/Perth').currentStart,'2027-01-01');
  assert.equal(dateBounds(new Date('2026-12-31T16:00:00Z'),'America/New_York').currentStart,'2026-01-01');
});

test('a failure in either new provider leaves all previously published station files intact', async () => {
  const directory=await mkdtemp(join(tmpdir(),'rain-international-'));
  const now=new Date('2026-01-04T12:00:00Z');
  const selectedStations=[{...us,historyStart:'2024-01-01'},{...nl,historyStart:'2024-01-01'}];
  const fetchData=async(station:typeof us,bounds:ReturnType<typeof dateBounds>,time:Date)=>splitDailyArchive(station,
    fillDays([],station.historyStart,bounds.yesterday).map(([date]):Row=>station.provider==='ghcn'?[date,1,1,'  W']:[date,1,1]),bounds,time,'https://example.com');
  const options={directory,now,selectedStations,fetchGlobalData:fetchData,fetchDutchData:fetchData};
  try {
    await updateData(options);
    const before=await readFile(join(directory,'stations.json'),'utf8');
    const current=await readFile(join(directory,us.id,'current.json'),'utf8');
    for(const provider of ['fetchGlobalData','fetchDutchData']) {
      await assert.rejects(updateData({...options,[provider]:async()=>{throw new Error('Source unavailable');}}));
      assert.equal(await readFile(join(directory,'stations.json'),'utf8'),before);
      assert.equal(await readFile(join(directory,us.id,'current.json'),'utf8'),current);
    }
  } finally { await rm(directory,{recursive:true,force:true}); }
});
