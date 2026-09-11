export type Row = [string, number | null, number];
export type Dataset = {rows: Row[]; fetchedAt: string; stationId: string; source?: string; validatedMonths?: number};
export const stations = [
  {id:'47662', name:'Tokyo', jp:'東京', pref:'44'},
  {id:'47759', name:'Kyoto', jp:'京都', pref:'61'},
  {id:'47772', name:'Osaka', jp:'大阪', pref:'62'},
  {id:'47412', name:'Sapporo', jp:'札幌', pref:'14'},
  {id:'47807', name:'Fukuoka', jp:'福岡', pref:'82'},
  {id:'47936', name:'Naha', jp:'那覇', pref:'91'},
];
export const endpoint='https://www.data.jma.go.jp/risk/obsdl/show/table';
export const monthNames=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
export const calendar=Array.from({length:365},(_,i)=>new Date(Date.UTC(2001,0,i+1)).toISOString().slice(5,10));
export const monthTicks=calendar.flatMap((d,i)=>d.endsWith('-15')?[i]:[]);
export function quantile(sorted:number[],p:number){const h=(sorted.length-1)*p, i=Math.floor(h);return sorted[i]+(sorted[Math.ceil(h)]-sorted[i])*(h-i);}
export function parseCSV(text:string):Row[]{
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);
  if(!text.includes('降水量の合計'))throw new Error('JMA hat keine Niederschlagsdatei geliefert. Bitte später erneut versuchen.');
  const rows:Row[]=[];
  for(const line of lines){const c=line.split(',').map(x=>x.replace(/^"|"$/g,''));
    if(!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(c[0]))continue;
    const [y,m,d]=c[0].split('/');const date=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    const q=Number(c[3]), value=c[1].trim()===''?null:Number(c[1]);
    if(!Number.isInteger(q))throw new Error('Unbekanntes JMA-Qualitätsformat.');
    rows.push([date,Number.isFinite(value)&&value!==null&&value>=0?value:null,q]);
  }
  if(!rows.length)throw new Error('Die JMA-Datei enthält keine Tageszeilen.');
  return rows;
}
export async function fetchJMA(id:string,from:string,to:string,signal:AbortSignal):Promise<Dataset>{
  const a=from.split('-'),b=to.split('-');
  const body=new URLSearchParams({stationNumList:JSON.stringify(['s'+id]),elementNumList:'[["101",""]]',ymdList:JSON.stringify([a[0],b[0],a[1],b[1],a[2],b[2]]),aggrgPeriod:'1',interAnnualType:'1',optionNumList:'[]',downloadFlag:'true',rmkFlag:'1',disconnectFlag:'1',youbiFlag:'0',fukenFlag:'0',kijiFlag:'0',csvFlag:'1',jikantaiFlag:'0',jikantaiList:'[]',ymdLiteral:'1'});
  const r=await fetch(endpoint,{method:'POST',body,credentials:'omit',signal:AbortSignal.any([signal,AbortSignal.timeout(120000)])});
  if(!r.ok)throw new Error(`JMA ist momentan nicht erreichbar (HTTP ${r.status}).`);
  const rows=parseCSV(new TextDecoder('shift_jis').decode(await r.arrayBuffer()));
  // Missing boundary rows must never silently turn into a complete cached block.
  const expected=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;
  if(rows.length!==expected||rows[0][0]!==from||rows.at(-1)?.[0]!==to||new Set(rows.map(r=>r[0])).size!==expected)throw new Error('JMA hat einen unvollständigen Zeitraum geliefert. Bitte erneut laden.');
  return {rows,fetchedAt:new Date().toISOString(),stationId:id,source:endpoint};
}
const memory=new Map<string,Dataset>();
let dbPromise:Promise<IDBDatabase>|undefined;
function db(){return dbPromise??=new Promise((resolve,reject)=>{const r=indexedDB.open('ame-jma-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('datasets');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function cacheGet(key:string):Promise<Dataset|undefined>{try{const d=await db();return await new Promise((resolve,reject)=>{const r=d.transaction('datasets').objectStore('datasets').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}catch{return memory.get(key);}}
export async function cachePut(key:string,value:Dataset):Promise<boolean>{memory.set(key,value);try{const d=await db();await new Promise<void>((resolve,reject)=>{const t=d.transaction('datasets','readwrite');t.objectStore('datasets').put(value,key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});return true;}catch{return false;}}
export function japanToday(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function yesterday(){return new Date(Date.parse(japanToday())-86400000).toISOString().slice(0,10);}
export function analyze(history:Row[],current:Row[],reference:'all'|'normal'='all',mode:'cumulative'|'gaussian'='cumulative',h=11){
  const byYear=new Map<number,Row[]>();
  for(const r of history){const year=+r[0].slice(0,4);if(reference==='normal'&&(year<1991||year>2020))continue;if(!byYear.has(year))byYear.set(year,[]);byYear.get(year)!.push(r);}
  const series:{year:number;values:number[]}[]=[],excluded:number[]=[];
  const gaussian=(v:number[],cyclic:boolean)=>v.map((_,i)=>{let total=0,weight=0;for(let k=-4*h;k<=4*h;k++){let j=i+k;if(cyclic)j=(j%v.length+v.length)%v.length;if(j<0||j>=v.length)continue;const w=Math.exp(-0.5*(k/h)**2);total+=v[j]*w;weight+=w;}return total/weight;});
  for(const [year,unsorted] of byYear){const rows=[...unsorted].sort((a,b)=>a[0].localeCompare(b[0]));const days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
    if(rows.length!==days||new Set(rows.map(r=>r[0])).size!==days||rows.some(r=>r[2]!==8||r[1]===null)||rows[0][0]!==`${year}-01-01`||rows.at(-1)?.[0]!==`${year}-12-31`){excluded.push(year);continue;}
    let sum=0;const values:number[]=[];for(const [date,v] of rows){sum+=v!;if(date.slice(5)==='02-29')continue;values.push(mode==='cumulative'?sum:v!);}
    series.push({year,values:mode==='gaussian'?gaussian(values,true):values});
  }
  series.sort((a,b)=>a.year-b.year);
  // End the observed curve at the first absent or non-normal day. Never treat a gap as zero.
  const valid:Row[]=[];const sorted=[...current].sort((a,b)=>a[0].localeCompare(b[0]));
  let next=sorted.length?`${sorted[0][0].slice(0,4)}-01-01`:'';
  for(const r of sorted){if(r[0]!==next||r[2]!==8||r[1]===null)break;valid.push(r);next=new Date(Date.parse(next)+86400000).toISOString().slice(0,10);}
  let sum=0;const values:number[]=[];for(const [date,v] of valid){sum+=v!;if(date.slice(5)!=='02-29')values.push(mode==='cumulative'?sum:v!);}
  let observed=values;
  if(mode==='gaussian'&&values.length){
    const y=+valid[0][0].slice(0,4);const previous=history.filter(r=>r[0]>=`${y-1}-01-01`&&r[0]<`${y}-01-01`&&r[0].slice(5)!=='02-29').sort((a,b)=>a[0].localeCompare(b[0])).slice(-4*h);
    const pad=previous.length===4*h&&previous.every(r=>r[2]===8&&r[1]!==null)?previous.map(r=>r[1]!):[];
    observed=gaussian([...pad,...values],false).slice(pad.length);
  }
  const points=calendar.map((date,i)=>{const v=series.map(s=>s.values[i]).sort((a,b)=>a-b);return {day:i,date,median:v.length?quantile(v,.5):null,low50:v.length?quantile(v,.25):null,high50:v.length?quantile(v,.75):null,low90:v.length?quantile(v,.05):null,high90:v.length?quantile(v,.95):null,min:v[0]??null,max:v.at(-1)??null,current:observed[i]??null};});
  const last=observed.length-1;
  const ranking=last>=0?series.map(s=>({year:s.year,value:s.values[last]})).sort((a,b)=>b.value-a.value):[];
  return {points,series,excluded,last,lastDate:valid.at(-1)?.[0],total:sum,currentYear:valid[0]?.[0].slice(0,4),ranking,higher:ranking.filter(r=>r.value>observed[last]).length,gap:valid.length<sorted.length};
}
