import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Tabs } from '@base-ui/react/tabs';
import { Map as MapIcon, X } from 'lucide-react';
import outlines from '@/assets/maps/country-outlines.json';
import { mapWidth, mapHeight, projectMapPoint, type MapBounds } from '@/lib/country-map';
import { countries, stations, providerNames, type Country, type Station } from '@/lib/stations';
import './station-map.css';

const mapRegions: Partial<Record<Country,string>> = {us:'Contiguous US', au:'Mainland & Tasmania', nl:'European Netherlands', fr:'Metropolitan France'};

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
  'ghcn-USW00094728': {name:'New York', x:520, y:210},
  'ghcn-USW00024233': {name:'Seattle', x:110, y:100},
  'ghcn-USW00023174': {name:'Los Angeles', x:170, y:350},
  'ghcn-USW00023234': {name:'San Francisco', x:105, y:245},
  'ghcn-USW00094846': {name:'Chicago', x:355, y:165},
  'ghcn-USW00012839': {name:'Miami', x:480, y:455},
  'ghcn-ASN00009021': {name:'Perth', x:80, y:355},
  'ghcn-ASN00086282': {name:'Melbourne', x:360, y:435},
  'ghcn-ASN00014015': {name:'Darwin', x:300, y:35},
  'ghcn-ASN00040842': {name:'Brisbane', x:525, y:190},
  'ghcn-ASN00066037': {name:'Sydney', x:550, y:335},
  'ghcn-ASN00094029': {name:'Hobart', x:520, y:515},
  'knmi-260': {name:'De Bilt', x:490, y:280},
  'knmi-235': {name:'De Kooy', x:210, y:90},
  'knmi-240': {name:'Amsterdam', x:130, y:230},
  'knmi-280': {name:'Groningen', x:500, y:80},
  'knmi-310': {name:'Vlissingen', x:145, y:440},
  'knmi-380': {name:'Maastricht', x:450, y:500},
  'ghcn-FRM00007149': {name:'Paris', x:380, y:120},
  'ghcn-FR000007650': {name:'Marseille', x:325, y:440},
  'ghcn-FR000007130': {name:'Rennes', x:140, y:180},
  'ghcn-FRE00104120': {name:'Nice', x:510, y:380},
  'ghcn-UK000056225': {name:'Oxford', x:430, y:465},
  'ghcn-UK000003162': {name:'Eskdalemuir', x:440, y:295},
  'ghcn-UK000003005': {name:'Lerwick', x:445, y:60},
  'ghcn-UK000003026': {name:'Stornoway', x:190, y:175},
  'ghcn-SWE00137568': {name:'Lund', x:210, y:500},
  'ghcn-SWE00139148': {name:'Uppsala', x:440, y:370},
  'ghcn-SWE00140908': {name:'Kiruna', x:450, y:70},
  'ghcn-SWE00139720': {name:'Sveg', x:160, y:290},
};

function CountryMap({country, selectedId, onSelect}: {country:Country; selectedId:string; onSelect:(id:string)=>void}) {
  const outline=outlines[country];
  const markers=stations.filter(station=>station.country===country).map(station=>({
    station, label:labels[station.id], point:projectMapPoint(station.longitude,station.latitude,outline.bounds as MapBounds),
  }));
  return (
    <div className="country-map" role="group" aria-label={`Station map: ${countries.find(item=>item.id===country)!.name}`}>
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
  const [country,setCountry]=useState<Country>(station.country);
  function selectStation(id:string) {
    onSelect(id);
    setOpen(false);
  }
  return (
    <Dialog.Root open={open} onOpenChange={next=>{if(next)setCountry(station.country);setOpen(next);}}>
      <Dialog.Trigger className="station-map-trigger" aria-label="Select station on map" title="Select station on map"><MapIcon size={17}/></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="station-map-backdrop"/>
        <Dialog.Popup className="station-map-dialog">
          <header className="station-map-header">
            <Dialog.Title>Select station</Dialog.Title>
            <Dialog.Close className="station-map-close" aria-label="Close map"><X size={18}/></Dialog.Close>
          </header>
          <Dialog.Description className="sr-only">Choose a country, then a station on the map. The station is selected immediately.</Dialog.Description>
          <Tabs.Root className="station-map-layout" value={country} onValueChange={value=>setCountry(value as Country)} orientation="vertical">
            <Tabs.List className="country-list" aria-label="Country" activateOnFocus>
              {countries.map(country=><Tabs.Tab key={country.id} value={country.id}>{country.name}</Tabs.Tab>)}
            </Tabs.List>
            {countries.map(country=>(
              <Tabs.Panel key={country.id} value={country.id} className="country-panel">
                <CountryMap country={country.id} selectedId={station.id} onSelect={selectStation}/>
                <p className="map-source">{mapRegions[country.id]?`${mapRegions[country.id]} · `:''}Outlines: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a> · Stations: {providerNames[stations.find(station=>station.country===country.id)!.provider]}</p>
              </Tabs.Panel>
            ))}
          </Tabs.Root>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
