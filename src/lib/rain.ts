import { usableRow, type Row } from "./datasets.ts";
import type { Provider } from "./stations.ts";

export const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const calendar=Array.from({length:365},(_,i)=>new Date(Date.UTC(2001,0,i+1)).toISOString().slice(5,10));
export const monthTicks=calendar.flatMap((d,i)=>d.endsWith('-15')?[i]:[]);
export function quantile(sorted:number[],p:number){const h=(sorted.length-1)*p, i=Math.floor(h);return sorted[i]+(sorted[Math.ceil(h)]-sorted[i])*(h-i);}
export function stationToday(timeZone='Asia/Tokyo'){return new Intl.DateTimeFormat('sv-SE',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function availableYears(history: Row[], current: Row[], latestYear: number, provider: Provider) {
  return [...new Set([latestYear, ...history.concat(current).filter(row => usableRow(row, provider)).map(row => Number(row[0].slice(0, 4)))])]
    .filter(year => year <= latestYear).sort((a, b) => b - a);
}

export function analyze(history:Row[],current:Row[],reference:'all'|'normal'='all',mode:'cumulative'|'gaussian'='cumulative',provider:Provider='jma',options:{year?:number;bandwidth?:number}={}){
  const {year:selectedYear,bandwidth:h=11}=options;
  const observedRows=selectedYear===undefined?current:history.concat(current).filter(row=>Number(row[0].slice(0,4))===selectedYear);
  const byYear=new Map<number,Row[]>();
  for(const r of history){const year=+r[0].slice(0,4);if(year===selectedYear)continue;if(reference==='normal'&&(year<1991||year>2020))continue;if(!byYear.has(year))byYear.set(year,[]);byYear.get(year)!.push(r);}
  const series:{year:number;values:number[]}[]=[],excluded:number[]=[];
  const gaussian=(v:number[],cyclic:boolean)=>v.map((_,i)=>{let total=0,weight=0;for(let k=-4*h;k<=4*h;k++){let j=i+k;if(cyclic)j=(j%v.length+v.length)%v.length;if(j<0||j>=v.length)continue;const w=Math.exp(-0.5*(k/h)**2);total+=v[j]*w;weight+=w;}return total/weight;});
  for(const [year,unsorted] of byYear){const rows=[...unsorted].sort((a,b)=>a[0].localeCompare(b[0]));const days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
    if(rows.length!==days||new Set(rows.map(r=>r[0])).size!==days||rows.some(r=>!usableRow(r,provider))||rows[0][0]!==`${year}-01-01`||rows.at(-1)?.[0]!==`${year}-12-31`){excluded.push(year);continue;}
    let sum=0;const values:number[]=[];for(const [date,v] of rows){sum+=v!;if(date.slice(5)==='02-29')continue;values.push(mode==='cumulative'?sum:v!);}
    series.push({year,values:mode==='gaussian'?gaussian(values,true):values});
  }
  series.sort((a,b)=>a.year-b.year);
  // End the observed curve at the first absent or non-normal day. Never treat a gap as zero.
  const valid:Row[]=[];const sorted=[...observedRows].sort((a,b)=>a[0].localeCompare(b[0]));
  let next=sorted.length?`${sorted[0][0].slice(0,4)}-01-01`:'';
  for(const r of sorted){if(r[0]!==next||!usableRow(r,provider))break;valid.push(r);next=new Date(Date.parse(next)+86400000).toISOString().slice(0,10);}
  let sum=0;const values:number[]=[];for(const [date,v] of valid){sum+=v!;if(date.slice(5)!=='02-29')values.push(mode==='cumulative'?sum:v!);}
  const lastUsableRow=sorted.findLast(r=>usableRow(r,provider));
  let reportedMinimumTotal=0,missingOrUnusableDays=0;const reportedMinimumValues:number[]=[];
  for(const r of sorted){
    if(!lastUsableRow||r[0]>lastUsableRow[0])break;
    if(usableRow(r,provider))reportedMinimumTotal+=r[1]!;else missingOrUnusableDays++;
    if(r[0].slice(5)!=='02-29')reportedMinimumValues.push(reportedMinimumTotal);
  }
  const hasLaterObservations=lastUsableRow!==undefined&&lastUsableRow[0]>(valid.at(-1)?.[0]??'');
  const year=selectedYear??(sorted.length?Number(sorted[0][0].slice(0,4)):undefined);
  const complete=year!==undefined&&valid.length===(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
  let observed=values;
  if(mode==='gaussian'&&complete){
    observed=gaussian(values,true);
  }else if(mode==='gaussian'&&values.length){
    const y=+valid[0][0].slice(0,4);const previous=history.filter(r=>r[0]>=`${y-1}-01-01`&&r[0]<`${y}-01-01`&&r[0].slice(5)!=='02-29').sort((a,b)=>a[0].localeCompare(b[0])).slice(-4*h);
    const pad=previous.length===4*h&&previous.every(r=>usableRow(r,provider))?previous.map(r=>r[1]!):[];
    observed=gaussian([...pad,...values],false).slice(pad.length);
  }
  const points=calendar.map((date,i)=>{const v=series.map(s=>s.values[i]).sort((a,b)=>a-b);return {day:i,date,median:v.length?quantile(v,.5):null,low50:v.length?quantile(v,.25):null,high50:v.length?quantile(v,.75):null,low90:v.length?quantile(v,.05):null,high90:v.length?quantile(v,.95):null,min:v[0]??null,max:v.at(-1)??null,current:observed[i]??null,reportedMinimum:mode==='cumulative'&&hasLaterObservations?(reportedMinimumValues[i]??null):null};});
  const last=observed.length-1;
  const ranking=last>=0?series.map(s=>({year:s.year,value:s.values[last]})).sort((a,b)=>b.value-a.value):[];
  return {points,series,excluded,last,lastDate:valid.at(-1)?.[0],total:sum,year,complete,provisionalTail:mode==='gaussian'&&!complete,ranking,higher:ranking.filter(r=>r.value>observed[last]).length,gap:valid.length<sorted.length,hasLaterObservations,reportedThrough:lastUsableRow?.[0],reportedMinimumTotal,missingOrUnusableDays};
}
