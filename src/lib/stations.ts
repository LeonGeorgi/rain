export type Provider = 'jma' | 'dwd';
export type Station = {
  id: string;
  name: string;
  provider: Provider;
  sourceId: string;
  timeZone: string;
  historyStart: string;
  jp?: string;
  pref?: string;
};

export const stations: Station[] = [
  ...[
    {id:'47662', name:'Tokyo', jp:'東京', pref:'44'},
    {id:'47759', name:'Kyoto', jp:'京都', pref:'61'},
    {id:'47772', name:'Osaka', jp:'大阪', pref:'62'},
    {id:'47412', name:'Sapporo', jp:'札幌', pref:'14'},
    {id:'47807', name:'Fukuoka', jp:'福岡', pref:'82'},
    {id:'47936', name:'Naha', jp:'那覇', pref:'91'},
  ].map(station => ({...station, provider:'jma' as const, sourceId:station.id, timeZone:'Asia/Tokyo', historyStart:'1876-01-01'})),
  ...[
    {sourceId:'00433', name:'Berlin-Tempelhof', historyStart:'1948-01-01'},
    {sourceId:'01975', name:'Hamburg-Fuhlsbüttel', historyStart:'1936-01-01'},
    {sourceId:'03379', name:'München-Stadt', historyStart:'1954-06-01'},
    {sourceId:'01420', name:'Frankfurt/Main', historyStart:'1935-07-01'},
    {sourceId:'02667', name:'Köln/Bonn', historyStart:'1957-07-01'},
    {sourceId:'01048', name:'Dresden-Klotzsche', historyStart:'1934-01-01'},
  ].map(station => ({...station, id:`dwd-${station.sourceId}`, provider:'dwd' as const, timeZone:'Europe/Berlin'})),
];
