import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Tabs } from '@base-ui/react/tabs';
import { Map as MapIcon, X } from 'lucide-react';
import outlines from '@/assets/maps/country-outlines.json';
import { mapWidth, mapHeight, projectMapPoint, type MapBounds } from '@/lib/country-map';
import { stations, type Provider, type Station } from '@/lib/stations';
import './station-map.css';

const countries: {provider: Provider; name: string}[] = [
  {provider:'jma', name:'Japan'},
  {provider:'dwd', name:'Germany'},
];

// Label callouts keep nearby stations (especially Kyoto and Osaka) individually
// selectable. The dots themselves retain their geographic positions.
const labels: Record<string, {name: string; x: number; y: number}> = {
  '47662': {name:'Tokyo', x:490, y:265},
  '47759': {name:'Kyoto', x:295, y:230},
  '47772': {name:'Osaka', x:385, y:350},
  '47412': {name:'Sapporo', x:470, y:80},
  '47807': {name:'Fukuoka', x:170, y:335},
  '47936': {name:'Naha', x:175, y:490},
  'dwd-00433': {name:'Berlin', x:520, y:190},
  'dwd-01975': {name:'Hamburg', x:280, y:90},
  'dwd-03379': {name:'Munich', x:430, y:475},
  'dwd-01420': {name:'Frankfurt', x:165, y:395},
  'dwd-02667': {name:'Cologne/Bonn', x:130, y:270},
  'dwd-01048': {name:'Dresden', x:520, y:315},
};

function CountryMap({provider, selectedId, onSelect}: {provider:Provider; selectedId:string; onSelect:(id:string)=>void}) {
  const outline=outlines[provider];
  const markers=stations.filter(station=>station.provider===provider).map(station=>({
    station, label:labels[station.id], point:projectMapPoint(station.longitude,station.latitude,outline.bounds as MapBounds),
  }));
  return (
    <div className="country-map" role="group" aria-label={`Station map: ${countries.find(country=>country.provider===provider)!.name}`}>
      <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} aria-hidden="true" focusable="false">
        <path className="country-outline" d={outline.path}/>
        {markers.map(({station,label,point})=>(
          <g key={station.id} className="map-marker" data-selected={station.id===selectedId||undefined} onClick={()=>onSelect(station.id)}>
            <line x1={point.x} y1={point.y} x2={label.x} y2={label.y}/>
            <circle cx={point.x} cy={point.y} r="10" fill="transparent"/>
            <circle className="station-dot" cx={point.x} cy={point.y} r="4.5"/>
          </g>
        ))}
      </svg>
      {markers.map(({station,label})=>(
        <button
          key={station.id}
          type="button"
          className="station-map-label"
          style={{left:`${label.x/mapWidth*100}%`,top:`${label.y/mapHeight*100}%`}}
          aria-label={`Select ${station.name}`}
          aria-pressed={station.id===selectedId}
          title={station.name}
          onClick={()=>onSelect(station.id)}
        >{label.name}</button>
      ))}
    </div>
  );
}

export function StationMapDialog({station,onSelect}:{station:Station;onSelect:(id:string)=>void}) {
  const [open,setOpen]=useState(false);
  const [country,setCountry]=useState<Provider>(station.provider);
  function selectStation(id:string) {
    onSelect(id);
    setOpen(false);
  }
  return (
    <Dialog.Root open={open} onOpenChange={next=>{if(next)setCountry(station.provider);setOpen(next);}}>
      <Dialog.Trigger className="station-map-trigger" aria-label="Select station on map" title="Select station on map"><MapIcon size={17}/></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="station-map-backdrop"/>
        <Dialog.Popup className="station-map-dialog">
          <header className="station-map-header">
            <Dialog.Title>Select station</Dialog.Title>
            <Dialog.Close className="station-map-close" aria-label="Close map"><X size={18}/></Dialog.Close>
          </header>
          <Dialog.Description className="sr-only">Choose a country, then a station on the map. The station is selected immediately.</Dialog.Description>
          <Tabs.Root className="station-map-layout" value={country} onValueChange={value=>setCountry(value as Provider)} orientation="vertical">
            <Tabs.List className="country-list" aria-label="Country" activateOnFocus>
              {countries.map(country=><Tabs.Tab key={country.provider} value={country.provider}>{country.name}</Tabs.Tab>)}
            </Tabs.List>
            {countries.map(country=>(
              <Tabs.Panel key={country.provider} value={country.provider} className="country-panel">
                <CountryMap provider={country.provider} selectedId={station.id} onSelect={selectStation}/>
                <p className="map-source">Outlines: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a> · Stations: {country.provider==='jma'?'JMA':'DWD'}</p>
              </Tabs.Panel>
            ))}
          </Tabs.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
