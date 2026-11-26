import {useEffect,useMemo,useRef,useState} from 'react';
import {StationMapDialog} from '@/components/StationMapDialog';
import {Methodology} from '@/components/Methodology';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Checkbox} from '@/components/ui/checkbox';
import {analyze,availableYears,monthNames,monthTicks,stationToday} from '@/lib/rain';
import {countries,stations,providerNames} from '@/lib/stations';
import type {Dataset} from '@/lib/datasets';
import {loadStationData} from '@/lib/published-data';
type Analysis=ReturnType<typeof analyze>;
const fmt=(v:number|null|undefined,d=0)=>v==null?'—':v.toLocaleString('en-GB',{maximumFractionDigits:d,minimumFractionDigits:d});
const dateLabel=(d?:string)=>d?new Date(d+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}):'—';
const colors=['var(--rain-comparison-1)','var(--rain-comparison-2)','var(--rain-comparison-3)'];
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function RainChart({data,mode,bands,years,svgRef}:{data:Analysis;mode:string;bands:string[];years:number[];svgRef:React.RefObject<SVGSVGElement|null>}){
 const box=useRef<HTMLDivElement>(null);const [width,setWidth]=useState(1000);const [hover,setHover]=useState<number|null>(null);
 useEffect(()=>{const r=new ResizeObserver(e=>setWidth(Math.max(300,e[0].contentRect.width)));if(box.current)r.observe(box.current);return()=>r.disconnect();},[]);
 const height=width<600?320:430,left=width<600?42:54,right=18,top=32,bottom=42,pw=width-left-right,ph=height-top-bottom;
 const selected=data.series.filter(s=>years.includes(s.year));
 const max=Math.max(1,...data.points.map(p=>Math.max(p.current??0,p.reportedMinimum??0,bands.includes('range')?p.max??0:bands.includes('90')?p.high90??0:p.high50??0)),...selected.flatMap(s=>s.values));
 const raw=max/5,mag=10**Math.floor(Math.log10(raw));const step=[1,2,2.5,5,10].map(x=>x*mag).find(x=>x>=raw)??mag*10;const yMax=Math.ceil(max/step)*step;
 const x=(i:number)=>left+i/364*pw,y=(v:number)=>top+ph-v/yMax*ph;
 const line=(values:(number|null)[])=>values.map((v,i)=>v===null?'':`${i===0||values[i-1]===null?'M':'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
 const area=(lo:'low50'|'low90',hi:'high50'|'high90')=>line(data.points.map(p=>p[hi]))+' '+data.points.map((p,i)=>({p,i})).reverse().map(({p,i})=>`L${x(i).toFixed(2)},${y(p[lo]??0).toFixed(2)}`).join(' ')+' Z';
 const point=hover!==null?data.points[hover]:null;
 const unit=mode==='cumulative'?'mm':'mm/day';
 return <div ref={box} className="chart-shell">
  <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${mode==='cumulative'?'Cumulative precipitation':'Smoothed daily precipitation'} with historical intervals. Use the arrow keys to select a calendar day.`} tabIndex={0} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();setHover(i=>Math.max(0,Math.min(364,(i??data.last)+(e.key==='ArrowRight'?1:-1))));}if(e.key==='Escape')setHover(null);}} onPointerMove={e=>{const b=e.currentTarget.getBoundingClientRect();setHover(Math.max(0,Math.min(364,Math.round(((e.clientX-b.left)*width/b.width-left)/pw*364))));}} onPointerLeave={()=>setHover(null)}>
   <rect width={width} height={height} fill="var(--background)"/>
   <text x={left} y={15} fill="var(--muted-foreground)" fontSize="12" fontFamily="system-ui">{mode==='cumulative'?'Precipitation since 1 January (mm)':'Average precipitation (mm/day)'}</text>
   {Array.from({length:Math.round(yMax/step)+1},(_,i)=>i*step).map(v=><g key={v}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} stroke="var(--rain-grid)"/><text x={left-12} y={y(v)+4} textAnchor="end" fill="var(--muted-foreground)" fontSize="12" fontFamily="system-ui">{fmt(v)}</text></g>)}
   {bands.includes('90')&&<path d={area('low90','high90')} fill="var(--rain-band-90)"/>}
   {bands.includes('50')&&<path d={area('low50','high50')} fill="var(--rain-band-50)" fillOpacity=".72"/>}
   {bands.includes('range')&&['min','max'].map(k=><path key={k} d={line(data.points.map(p=>p[k as 'min'|'max']))} fill="none" stroke="var(--rain-range)" strokeWidth="1"/>)}
   <path d={line(data.points.map(p=>p.median))} fill="none" stroke="var(--primary)" strokeWidth="2"/>
   {selected.map(s=><path key={s.year} d={line(s.values)} fill="none" stroke={colors[years.indexOf(s.year)%3]} strokeWidth="1.4"/>)}
   {!data.provisionalTail?<path d={line(data.points.map(p=>p.current))} fill="none" stroke="var(--rain-current)" strokeWidth="2.8"/>:<><path d={line(data.points.map((p,i)=>i<=data.last-44?p.current:null))} fill="none" stroke="var(--rain-current)" strokeWidth="2.8"/><path d={line(data.points.map((p,i)=>i>=Math.max(0,data.last-44)?p.current:null))} fill="none" stroke="var(--rain-current)" strokeWidth="2.8" strokeDasharray="5 4"/></>}
   {mode==='cumulative'&&data.hasLaterObservations&&<path d={line(data.points.map((p,i)=>i>=Math.max(0,data.last)?p.reportedMinimum:null))} fill="none" stroke="var(--rain-current)" strokeWidth="2.4" strokeDasharray="3 5" opacity=".85"/>}
   {data.last>=0&&<circle cx={x(data.last)} cy={y(data.points[data.last].current!)} r="4.5" fill="var(--rain-current)" stroke="var(--background)" strokeWidth="2"/>}
   {monthTicks.map((i,m)=>(width>=500||m%2===0)&&<text key={i} x={x(i)} y={height-12} textAnchor="middle" fill="var(--muted-foreground)" fontSize={width<500?12:13} fontFamily="system-ui">{monthNames[m]}</text>)}
   {point&&<g><line x1={x(hover!)} x2={x(hover!)} y1={top} y2={height-bottom} stroke="var(--muted-foreground)" strokeDasharray="3 4"/>{point.current!==null&&<circle cx={x(hover!)} cy={y(point.current)} r="4" fill="var(--rain-current)"/>}</g>}
  </svg>
  {point&&<div className="chart-tooltip" style={{left:Math.min(width-205,Math.max(5,x(hover!)+12))}}><strong>{Number(point.date.slice(3))} {monthNames[+point.date.slice(0,2)-1]}</strong><span>Median <b>{fmt(point.median,1)} {unit}</b></span><span>{data.year} <b style={{color:'var(--rain-current)'}}>{point.current!==null?fmt(point.current,1):point.reportedMinimum!==null?`≥ ${fmt(point.reportedMinimum,1)}`:'—'} {unit}</b></span><span>90% <b>{fmt(point.low90)}–{fmt(point.high90)} {unit}</b></span></div>}
 </div>;
}
export default function App(){
 const [stationId,setStationId]=useState('47662');const [history,setHistory]=useState<Dataset|null>(null);const [current,setCurrent]=useState<Dataset|null>(null);
 const [status,setStatus]=useState('Loading Tokyo data …');const [error,setError]=useState('');const [storageWarning,setStorageWarning]=useState(false);const [busy,setBusy]=useState(true);const [reload,setReload]=useState(0);
 const [mode,setMode]=useState<'cumulative'|'gaussian'>('cumulative');const [reference,setReference]=useState<'all'|'normal'>('all');const [bands,setBands]=useState(['50','90','range']);const [compare,setCompare]=useState(false);
 const [requestedYear,setRequestedYear]=useState<number|null>(null);
 const svgRef=useRef<SVGSVGElement>(null);const station=stations.find(s=>s.id===stationId)!;
 const today=stationToday(station.timeZone);
 const latestYear=Number(current?.from.slice(0,4)??today.slice(0,4));
 const yearOptions=useMemo(()=>availableYears(history?.rows??[],current?.rows??[],latestYear,stations.find(s=>s.id===stationId)!.provider),[history,current,latestYear,stationId]);
 const selectedYear=requestedYear!==null&&yearOptions.includes(requestedYear)?requestedYear:latestYear;
 const yearIndex=yearOptions.indexOf(selectedYear);
 const exportName=`${station.provider}-${station.sourceId}-${selectedYear}-${mode}`;
 const selectedSource=selectedYear===latestYear?current?.source:history?.source;
 useEffect(() => {
  const abort = new AbortController();
  async function run() {
   setBusy(true); setError(''); setHistory(null); setCurrent(null);
   setStatus('Loading published station data …');
   try {
    const data = await loadStationData(stationId, abort.signal, (history, current) => {
     if (abort.signal.aborted) return;
     if (history) setHistory(history);
     if (current) setCurrent(current);
    });
    if (abort.signal.aborted) return;
    setHistory(data.history); setCurrent(data.current); setStorageWarning(data.storageWarning);
    setStatus(`Published on ${dateLabel(data.updatedAt.slice(0, 10))}`);
   } catch (error) {
    if (abort.signal.aborted) return;
    setError(error instanceof Error ? error.message : 'The published data could not be loaded.');
    setStatus('Last locally saved data');
   } finally {
    if (!abort.signal.aborted) setBusy(false);
   }
  }
  void run();
  return () => abort.abort();
 }, [stationId, reload]);
 const data=useMemo(()=>analyze(history?.rows??[],current?.rows??[],reference,mode,stations.find(s=>s.id===stationId)!.provider,{year:selectedYear}),[history,current,reference,mode,stationId,selectedYear]);
 const cumulative=useMemo(()=>mode==='cumulative'?data:analyze(history?.rows??[],current?.rows??[],reference,'cumulative',stations.find(s=>s.id===stationId)!.provider,{year:selectedYear}),[history,current,reference,mode,data,stationId,selectedYear]);
 const topYears=cumulative.ranking.slice(0,3).map(r=>r.year);const years=compare?topYears:[];
 const median=cumulative.last>=0?cumulative.points[cumulative.last].median:null;
 const toggle=(key:string)=>setBands(v=>v.includes(key)?v.filter(x=>x!==key):[...v,key]);
 const exportCSV=()=>{
  const unit=mode==='cumulative'?'mm':'mm_per_day';
  const header=['day_of_year','month_day','n_historical_years',...['median','p25','p75','p05','p95','min','max',`selected_${selectedYear}`,...years.map(year=>`year_${year}`)].map(name=>`${name}_${unit}`),'station','historical_source','selected_source','license'];
  const cell=(value:unknown)=>typeof value==='number'?String(Math.round(value*1000000)/1000000):`"${String(value??'').replaceAll('"','""')}"`;
  const rows=data.points.map((point,index)=>[
   index+1,point.date,data.series.length,point.median,point.low50,point.high50,point.low90,point.high90,point.min,point.max,point.current,
   ...years.map(year=>data.series.find(series=>series.year===year)?.values[index]),
   `${providerNames[station.provider]} ${station.sourceId} ${station.name}`,history?.source,selectedSource,
   station.provider==='dwd'?'Source: DWD CDC; processed; https://creativecommons.org/licenses/by/4.0/':station.provider==='knmi'?'Source: KNMI; processed; CC0; KNMI is not involved and does not necessarily endorse this work; https://www.knmi.nl/copyright':station.provider==='ghcn'?`Menne et al. (2012), GHCN-Daily v3; NOAA NCEI; https://doi.org/10.7289/V5D21VHZ; accessed ${history?.fetchedAt.slice(0,10)}`:'',
  ].map(cell).join(','));
  download(new Blob([header.join(',')+'\n'+rows.join('\n')],{type:'text/csv;charset=utf-8'}),`${exportName}.csv`);
 };
 const exportPNG=async()=>{
  let url:string|undefined;
  try {
   if(!svgRef.current)return;
   const svg=svgRef.current.cloneNode(true) as SVGSVGElement;
   // Resolve inherited CSS colors before serializing the standalone SVG.
   const sourceNodes=[svgRef.current,...svgRef.current.querySelectorAll('*')];
   const exportNodes=[svg,...svg.querySelectorAll('*')];
   sourceNodes.forEach((node,index)=>{
    const style=getComputedStyle(node);
    for(const property of ['fill','stroke','color']) {
     (exportNodes[index] as SVGElement).style.setProperty(property,style.getPropertyValue(property));
    }
   });
   const theme=getComputedStyle(svgRef.current);
   const scale=Math.max(1,900/svg.width.baseVal.value);
   svg.setAttribute('width',String(svg.width.baseVal.value*scale));
   svg.setAttribute('height',String(svg.height.baseVal.value*scale));
   url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
   const img=new Image();
   await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=reject;img.src=url!;});
   const canvas=document.createElement('canvas');
   canvas.width=img.width*2;canvas.height=(img.height+110)*2;
   const ctx=canvas.getContext('2d')!;
   ctx.scale(2,2);ctx.fillStyle=theme.getPropertyValue('--background').trim();ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.fillStyle=theme.getPropertyValue('--foreground').trim();ctx.font='600 20px system-ui';
   ctx.fillText(`${station.name} · ${selectedYear} · ${mode==='cumulative'?'Cumulative precipitation':'Precipitation · Gaussian σ = 11 days'}`,25,30);
   ctx.font='12px system-ui';
   ctx.fillText(`${providerNames[station.provider]} ${station.sourceId} · ${data.series.length} complete years · Through ${data.lastDate??'—'} · Median / ${bands.join(' / ')} · Comparison ${years.join(', ')||'off'}`,25,53,img.width-50);
   ctx.fillText(station.provider==='dwd'
    ? `Source: DWD CDC · processed · CC BY 4.0 (creativecommons.org/licenses/by/4.0/)${selectedYear===latestYear?' · Provisional values':''}`
    : station.provider==='ghcn' ? 'Source: NOAA NCEI · GHCN-Daily v3 · Menne et al. (2012) · doi.org/10.7289/V5D21VHZ'
    : station.provider==='knmi' ? 'Source: KNMI · CC0 · processed · KNMI is not involved and does not necessarily endorse this work'
    : 'Source: Japan Meteorological Agency · data.jma.go.jp/risk/obsdl/',25,75,img.width-50);
   ctx.drawImage(img,0,100);
   canvas.toBlob(blob=>{if(blob)download(blob,`${exportName}.png`);},'image/png');
  } catch {
   setError('PNG export failed. CSV export is still available.');
  } finally {
   if(url)URL.revokeObjectURL(url);
  }
 };
 useEffect(()=>{const ctx=(document as Document&{modelContext?:{registerTool:(t:unknown,o:unknown)=>Promise<void>}}).modelContext;if(!ctx)return;const lifecycle=new AbortController();void Promise.resolve(ctx.registerTool({name:'get_precipitation_summary',description:'Read the currently displayed station, data coverage and cumulative rainfall comparison.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:(input:unknown)=>{if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('Expected an empty object.');return {station:station.name,stationId,year:selectedYear,mode,reference,completeYears:data.series.length,lastExactDate:data.lastDate,exactTotalMm:cumulative.total,reportedThrough:cumulative.reportedThrough,reportedMinimumMm:cumulative.hasLaterObservations?cumulative.reportedMinimumTotal:null,missingOrUnusableDays:cumulative.missingOrUnusableDays,historicalYearsAbove:cumulative.higher,loading:busy,error:error||null};}},{signal:lifecycle.signal})).catch(()=>{});return()=>lifecycle.abort();},[station,stationId,selectedYear,mode,reference,data,cumulative,busy,error]);
 return (
  <div className="app">
   <main>
    <h1 className="sr-only">Daily precipitation compared with historical records</h1>
    <div className="toolbar">
     <div className="station-picker">
      <label htmlFor="station">Station</label>
      <div className="station-controls">
      <select id="station" aria-label="Select weather station" value={stationId} onChange={event=>setStationId(event.target.value)}>
       {countries.map(country=>(
        <optgroup key={country.id} label={country.name}>
         {stations.filter(s=>s.country===country.id).map(s=><option key={s.id} value={s.id}>{s.name}{s.jp?` · ${s.jp}`:''}</option>)}
        </optgroup>
       ))}
      </select>
      <StationMapDialog station={station} onSelect={setStationId}/>
      </div>
     </div>
     <div className="year-picker">
      <label htmlFor="year">Year</label>
      <div className="year-controls">
       <button type="button" aria-label="Previous year" disabled={busy||yearIndex>=yearOptions.length-1} onClick={()=>setRequestedYear(yearOptions[yearIndex+1])}>−</button>
       <select id="year" aria-label="Displayed year" value={selectedYear} disabled={busy} onChange={event=>setRequestedYear(Number(event.target.value))}>
        {yearOptions.map(year=><option key={year} value={year}>{year}</option>)}
       </select>
       <button type="button" aria-label="Next year" disabled={busy||yearIndex<=0} onClick={()=>setRequestedYear(yearOptions[yearIndex-1])}>+</button>
       {selectedYear!==latestYear&&<button type="button" className="current-year-button" disabled={busy} title={`Return to ${latestYear}`} onClick={()=>{
        setRequestedYear(null);
        document.getElementById('year')?.focus();
       }}>Current year</button>}
      </div>
     </div>
     <Tabs value={mode} onValueChange={v=>setMode(v as typeof mode)}>
      <TabsList aria-label="Chart view">
       <TabsTrigger value="cumulative">Cumulative</TabsTrigger>
       <TabsTrigger value="gaussian">Daily trend</TabsTrigger>
      </TabsList>
     </Tabs>
     <div className="reference">
      <label htmlFor="reference">Reference</label>
      <select id="reference" aria-label="Select historical reference period" value={reference} onChange={event=>setReference(event.target.value as typeof reference)}>
       <option value="all">All years through {history?.to.slice(0,4) ?? Number(today.slice(0,4))-1}</option>
       <option value="normal">1991–2020</option>
      </select>
     </div>
    </div>
    <section className="plot" aria-label="Precipitation analysis">
     <div className="plot-meta">
      <p>{data.series.length?`${data.series[0].year}–${data.series.at(-1)!.year} · ${data.series.length} complete reference years`:'Historical daily data'}{mode==='gaussian'?' · Gaussian smoothing, σ = 11 days':''}</p>
      <div className="export-buttons" aria-label="Export">
       <button onClick={exportCSV} disabled={!data.series.length} aria-label="Download calculated data as CSV">CSV ↓</button>
       <button onClick={exportPNG} disabled={!data.series.length} aria-label="Download chart as PNG">PNG ↓</button>
      </div>
     </div>
     {data.series.length
      ? <RainChart data={data} mode={mode} bands={bands} years={years} svgRef={svgRef}/>
      : <div className="empty-chart" aria-busy={busy}>
         <h3>{busy?'Loading observations …':'No complete data series available'}</h3>
         <p>{busy?status:'Select another station or try loading the data again.'}</p>
        </div>}
     <div className="legend">
     <span className="legend-item current-year"><i style={{background:'var(--rain-current)'}}/>{selectedYear}</span>
      {mode==='cumulative'&&data.hasLaterObservations&&<span className="legend-item reported-minimum"><i/>Reported minimum after gaps</span>}
      <span className="legend-item"><i style={{background:'var(--primary)'}}/>Median</span>
      <div className="band-controls" role="group" aria-label="Historical distribution">
       {[['50','50%'],['90','90%'],['range','Min–Max']].map(([key,label])=>(
        <label className="legend-check" key={key}>
         <Checkbox checked={bands.includes(key)} onCheckedChange={()=>toggle(key)}/>
         <span className={`swatch swatch-${key}`}/>{label}
        </label>
       ))}
      </div>
      <label className="legend-check comparison-toggle"><Checkbox checked={compare} onCheckedChange={v=>setCompare(v===true)}/>Comparison years</label>
     </div>
     {compare&&topYears.length>0&&(
      <div className="comparison-legend">
       {topYears.map((year,i)=><span className="legend-item" key={year}><i style={{background:colors[i]}}/>{year}</span>)}
       <span className="comparison-note">Highest totals through the same date</span>
      </div>
     )}
    </section>
    <section className="stats" aria-label="Comparison through the same calendar day">
     <div>
      <span>Through {data.lastDate?dateLabel(data.lastDate):'the last complete day'}</span>
      <p>{fmt(cumulative.last>=0?cumulative.total:null,1)}<small> mm</small></p>
      <em>Precipitation {selectedYear}</em>
     </div>
     <div>
      <span>Historical median</span>
      <p>{fmt(median,1)}<small> mm</small></p>
      <em>{median&&cumulative.last>=0?`${cumulative.total>=median?'+':''}${fmt((cumulative.total/median-1)*100,1)}% relative to the median`:'—'}</em>
     </div>
     <div>
      <span>Historical years with more precipitation</span>
      <p>{cumulative.last>=0&&data.series.length?cumulative.higher:'—'}<small> / {data.series.length}</small></p>
      <em>All comparisons through the same date</em>
     </div>
    </section>
    <div className="data-status" aria-live="polite">
     <span>{status}{station.provider==='dwd'&&current&&selectedYear===latestYear?' · Current DWD values are provisional':station.provider==='ghcn'?' · GHCN-Daily observations may be revised':''}</span>
     <button disabled={busy} onClick={()=>setReload(v=>v+1)}>Refresh</button>
    </div>
    {error&&<div role="alert" className="notice">{error}{history?' Previously loaded data remains available.':''}</div>}
    {storageWarning&&<div className="notice">This browser does not allow persistent storage. Data is kept in memory for this session only.</div>}
    {data.hasLaterObservations&&<div className="notice">The solid curve is exact {data.lastDate?`through ${dateLabel(data.lastDate)}`:'for no continuous day from 1 January'}. The dotted continuation is a lower bound of ≥ {fmt(data.reportedMinimumTotal,1)} mm through {dateLabel(data.reportedThrough)}, because {data.missingOrUnusableDays} {data.missingOrUnusableDays===1?'day is':'days are'} missing or unusable. Rankings remain limited to the exact period.</div>}
    {data.gap&&!data.hasLaterObservations&&<div className="notice">The selected year’s curve stops before the first missing or unusable daily observation.</div>}
    {!busy&&data.last<0&&<div className="notice">No continuous usable observations from 1 January are available for {selectedYear}.</div>}
    <Methodology station={station} excluded={data.excluded} today={today}/>
   </main>
  </div>
 );
}
