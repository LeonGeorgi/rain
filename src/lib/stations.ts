export type Provider = 'jma' | 'dwd';
export type Station = {
  id: string;
  name: string;
  provider: Provider;
  sourceId: string;
  timeZone: string;
  historyStart: string;
  latitude: number;
  longitude: number;
  jp?: string;
  pref?: string;
};

export const stations: Station[] = [
  ...[
    {id:'47662', name:'Tokyo', jp:'東京', latitude:35.691667, longitude:139.75, pref:'44'},
    {id:'47759', name:'Kyoto', jp:'京都', latitude:35.013333, longitude:135.731667, pref:'61'},
    {id:'47772', name:'Osaka', jp:'大阪', latitude:34.681667, longitude:135.518333, pref:'62'},
    {id:'47412', name:'Sapporo', jp:'札幌', latitude:43.06, longitude:141.328333, pref:'14'},
    {id:'47807', name:'Fukuoka', jp:'福岡', latitude:33.581667, longitude:130.375, pref:'82'},
    {id:'47936', name:'Naha', jp:'那覇', latitude:26.206667, longitude:127.686667, pref:'91'},
  ].map(station => ({...station, provider:'jma' as const, sourceId:station.id, timeZone:'Asia/Tokyo', historyStart:'1876-01-01'})),
  ...[
    {sourceId:'00433', latitude:52.4676, longitude:13.4020, name:'Berlin-Tempelhof', historyStart:'1948-01-01'},
    {sourceId:'01975', latitude:53.6332, longitude:9.9881, name:'Hamburg-Fuhlsbüttel', historyStart:'1936-01-01'},
    {sourceId:'03379', latitude:48.1632, longitude:11.5429, name:'München-Stadt', historyStart:'1954-06-01'},
    {sourceId:'01420', latitude:50.0259, longitude:8.5213, name:'Frankfurt/Main', historyStart:'1935-07-01'},
    {sourceId:'02667', latitude:50.8645, longitude:7.1575, name:'Köln/Bonn', historyStart:'1957-07-01'},
    {sourceId:'01048', latitude:51.1278, longitude:13.7543, name:'Dresden-Klotzsche', historyStart:'1934-01-01'},
  ].map(station => ({...station, id:`dwd-${station.sourceId}`, provider:'dwd' as const, timeZone:'Europe/Berlin'})),
];
