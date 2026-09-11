import type { Dataset } from "./datasets.ts";

const memory=new Map<string,Dataset>();
let dbPromise:Promise<IDBDatabase>|undefined;
function db(){return dbPromise??=new Promise((resolve,reject)=>{const r=indexedDB.open('ame-jma-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('datasets');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function cacheGet(key:string):Promise<Dataset|undefined>{try{const d=await db();return await new Promise((resolve,reject)=>{const r=d.transaction('datasets').objectStore('datasets').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}catch{return memory.get(key);}}
export async function cachePut(key:string,value:Dataset):Promise<boolean>{memory.set(key,value);try{const d=await db();await new Promise<void>((resolve,reject)=>{const t=d.transaction('datasets','readwrite');t.objectStore('datasets').put(value,key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});return true;}catch{return false;}}
