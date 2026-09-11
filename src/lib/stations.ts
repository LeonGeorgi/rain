export type Provider = 'jma' | 'dwd' | 'ghcn' | 'knmi';
export const countries = [
  {id:'jp', name:'Japan', mapCode:'JPN'},
  {id:'de', name:'Germany', mapCode:'DEU'},
  {id:'us', name:'United States', mapCode:'USA'},
  {id:'au', name:'Australia', mapCode:'AUS'},
  {id:'nl', name:'Netherlands', mapCode:'NLD'},
  {id:'fr', name:'France', mapCode:'FRA'},
  {id:'gb', name:'United Kingdom', mapCode:'GBR'},
  {id:'se', name:'Sweden', mapCode:'SWE'},
  {id:'es', name:'Spain', mapCode:'ESP'},
  {id:'ch', name:'Switzerland', mapCode:'CHE'},
  {id:'at', name:'Austria', mapCode:'AUT'},
  {id:'ie', name:'Ireland', mapCode:'IRL'},
  {id:'no', name:'Norway', mapCode:'NOR'},
] as const;
export type Country = typeof countries[number]['id'];
export const providerNames: Record<Provider, string> = {jma:'JMA', dwd:'DWD', ghcn:'NOAA GHCN-Daily', knmi:'KNMI'};
export type Station = {
  id: string;
  name: string;
  provider: Provider;
  country: Country;
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
  ].map(station => ({...station, provider:'jma' as const, country:'jp' as const, sourceId:station.id, timeZone:'Asia/Tokyo', historyStart:'1876-01-01'})),
  ...[
    {sourceId:'00433', latitude:52.4676, longitude:13.4020, name:'Berlin-Tempelhof', historyStart:'1948-01-01'},
    {sourceId:'01975', latitude:53.6332, longitude:9.9881, name:'Hamburg-Fuhlsbüttel', historyStart:'1936-01-01'},
    {sourceId:'03379', latitude:48.1632, longitude:11.5429, name:'Munich (city)', historyStart:'1954-06-01'},
    {sourceId:'01420', latitude:50.0259, longitude:8.5213, name:'Frankfurt/Main', historyStart:'1935-07-01'},
    {sourceId:'02667', latitude:50.8645, longitude:7.1575, name:'Cologne/Bonn', historyStart:'1957-07-01'},
    {sourceId:'01048', latitude:51.1278, longitude:13.7543, name:'Dresden-Klotzsche', historyStart:'1934-01-01'},
  ].map(station => ({...station, id:`dwd-${station.sourceId}`, provider:'dwd' as const, country:'de' as const, timeZone:'Europe/Berlin'})),
  ...[
    {sourceId:'USW00094728', name:'New York (Central Park)', country:'us' as const, latitude:40.7789, longitude:-73.9692, timeZone:'America/New_York', historyStart:'1869-01-01'},
    {sourceId:'USW00024233', name:'Seattle–Tacoma Airport', country:'us' as const, latitude:47.4447, longitude:-122.3144, timeZone:'America/Los_Angeles', historyStart:'1948-01-01'},
    {sourceId:'ASN00009021', name:'Perth Airport', country:'au' as const, latitude:-31.9275, longitude:115.9764, timeZone:'Australia/Perth', historyStart:'1944-05-01'},
    {sourceId:'ASN00086282', name:'Melbourne Airport', country:'au' as const, latitude:-37.6655, longitude:144.8321, timeZone:'Australia/Melbourne', historyStart:'1970-07-01'},
    {sourceId:'USW00023174', name:'Los Angeles Airport', country:'us' as const, latitude:33.9381, longitude:-118.3867, timeZone:'America/Los_Angeles', historyStart:'1944-08-01'},
    {sourceId:'USW00023234', name:'San Francisco Airport', country:'us' as const, latitude:37.6197, longitude:-122.3656, timeZone:'America/Los_Angeles', historyStart:'1945-07-01'},
    {sourceId:'USW00094846', name:'Chicago O’Hare Airport', country:'us' as const, latitude:41.9603, longitude:-87.9317, timeZone:'America/Chicago', historyStart:'1958-11-01'},
    {sourceId:'USW00012839', name:'Miami Airport', country:'us' as const, latitude:25.7881, longitude:-80.3169, timeZone:'America/New_York', historyStart:'1948-01-01'},
    {sourceId:'ASN00014015', name:'Darwin Airport', country:'au' as const, latitude:-12.4239, longitude:130.8925, timeZone:'Australia/Darwin', historyStart:'1941-01-01'},
    {sourceId:'ASN00040842', name:'Brisbane Airport', country:'au' as const, latitude:-27.3917, longitude:153.1292, timeZone:'Australia/Brisbane', historyStart:'1994-07-01'},
    {sourceId:'ASN00066037', name:'Sydney Airport', country:'au' as const, latitude:-33.9465, longitude:151.1731, timeZone:'Australia/Sydney', historyStart:'1929-09-01'},
    {sourceId:'ASN00094029', name:'Hobart (Ellerslie Road)', country:'au' as const, latitude:-42.8897, longitude:147.3278, timeZone:'Australia/Hobart', historyStart:'1893-06-01'},
    {sourceId:'FRM00007149', name:'Paris Orly Airport', country:'fr' as const, latitude:48.7167, longitude:2.3842, timeZone:'Europe/Paris', historyStart:'1921-03-01'},
    {sourceId:'FR000007650', name:'Marseille–Marignane', country:'fr' as const, latitude:43.4378, longitude:5.2158, timeZone:'Europe/Paris', historyStart:'1921-01-01'},
    {sourceId:'FR000007130', name:'Rennes–Saint-Jacques', country:'fr' as const, latitude:48.0689, longitude:-1.7339, timeZone:'Europe/Paris', historyStart:'1944-11-01'},
    {sourceId:'FRE00104120', name:'Nice Airport', country:'fr' as const, latitude:43.6489, longitude:7.2089, timeZone:'Europe/Paris', historyStart:'1942-07-01'},
    {sourceId:'UK000056225', name:'Oxford', country:'gb' as const, latitude:51.7667, longitude:-1.2667, timeZone:'Europe/London', historyStart:'1827-01-01'},
    {sourceId:'UK000003162', name:'Eskdalemuir', country:'gb' as const, latitude:55.3167, longitude:-3.2, timeZone:'Europe/London', historyStart:'1931-01-01'},
    {sourceId:'UK000003005', name:'Lerwick', country:'gb' as const, latitude:60.1331, longitude:-1.1831, timeZone:'Europe/London', historyStart:'1930-12-01'},
    {sourceId:'UK000003026', name:'Stornoway Airport', country:'gb' as const, latitude:58.33, longitude:-6.32, timeZone:'Europe/London', historyStart:'1930-12-01'},
    {sourceId:'SWE00137568', name:'Lund', country:'se' as const, latitude:55.7, longitude:13.2, timeZone:'Europe/Stockholm', historyStart:'1863-01-01'},
    {sourceId:'SWE00139148', name:'Uppsala', country:'se' as const, latitude:59.86, longitude:17.63, timeZone:'Europe/Stockholm', historyStart:'1836-01-01'},
    {sourceId:'SWE00140908', name:'Kiruna', country:'se' as const, latitude:67.8497, longitude:20.25, timeZone:'Europe/Stockholm', historyStart:'1898-08-01'},
    {sourceId:'SWE00139720', name:'Sveg', country:'se' as const, latitude:62.0192, longitude:14.1903, timeZone:'Europe/Stockholm', historyStart:'1875-07-01'},
    {sourceId:'SP000003195', name:'Madrid Retiro', country:'es' as const, latitude:40.4117, longitude:-3.6781, timeZone:'Europe/Madrid', historyStart:'1920-01-01'},
    {sourceId:'SP000008181', name:'Barcelona Airport', country:'es' as const, latitude:41.2928, longitude:2.0697, timeZone:'Europe/Madrid', historyStart:'1924-03-01'},
    {sourceId:'SP000008027', name:'San Sebastián–Igueldo', country:'es' as const, latitude:43.3075, longitude:-2.0392, timeZone:'Europe/Madrid', historyStart:'1916-04-01'},
    {sourceId:'SZ000003700', name:'Zürich Fluntern', country:'ch' as const, latitude:47.3831, longitude:8.5667, timeZone:'Europe/Zurich', historyStart:'1901-01-01'},
    {sourceId:'SZ000008390', name:'Geneva Observatory', country:'ch' as const, latitude:46.2, longitude:6.15, timeZone:'Europe/Zurich', historyStart:'1901-01-01'},
    {sourceId:'SZ000009480', name:'Lugano', country:'ch' as const, latitude:46.0, longitude:8.9667, timeZone:'Europe/Zurich', historyStart:'1901-01-01'},
    {sourceId:'AU000005901', name:'Vienna', country:'at' as const, latitude:48.2331, longitude:16.35, timeZone:'Europe/Vienna', historyStart:'1901-01-01'},
    {sourceId:'AU000006306', name:'Salzburg', country:'at' as const, latitude:47.8, longitude:13.0, timeZone:'Europe/Vienna', historyStart:'1901-01-01'},
    {sourceId:'AU000011801', name:'Innsbruck', country:'at' as const, latitude:47.2667, longitude:11.4, timeZone:'Europe/Vienna', historyStart:'1901-01-01'},
    {sourceId:'EI000003969', name:'Dublin Phoenix Park', country:'ie' as const, latitude:53.3639, longitude:-6.3192, timeZone:'Europe/Dublin', historyStart:'1867-01-01'},
    {sourceId:'EI000003980', name:'Malin Head', country:'ie' as const, latitude:55.3717, longitude:-7.34, timeZone:'Europe/Dublin', historyStart:'1885-01-01'},
    {sourceId:'NO000001026', name:'Tromsø', country:'no' as const, latitude:69.6539, longitude:18.9281, timeZone:'Europe/Oslo', historyStart:'1920-07-01'},
    {sourceId:'NOE00109680', name:'Stavanger Sola', country:'no' as const, latitude:58.8842, longitude:5.6367, timeZone:'Europe/Oslo', historyStart:'1941-08-01'},
    {sourceId:'NOE00100574', name:'Bulken', country:'no' as const, latitude:60.6458, longitude:6.2233, timeZone:'Europe/Oslo', historyStart:'1895-06-01'},
  ].map(station => ({...station, id:`ghcn-${station.sourceId}`, provider:'ghcn' as const})),
  ...[
    {sourceId:'260', name:'De Bilt', latitude:52.101, longitude:5.177, historyStart:'1901-01-01'},
    {sourceId:'235', name:'De Kooy (Den Helder)', latitude:52.924, longitude:4.785, historyStart:'1906-01-01'},
    {sourceId:'240', name:'Amsterdam Schiphol Airport', latitude:52.318, longitude:4.790, historyStart:'1951-01-01'},
    {sourceId:'280', name:'Groningen Airport Eelde', latitude:53.125, longitude:6.585, historyStart:'1906-01-01'},
    {sourceId:'310', name:'Vlissingen', latitude:51.442, longitude:3.596, historyStart:'1906-01-01'},
    {sourceId:'380', name:'Maastricht Airport', latitude:50.906, longitude:5.762, historyStart:'1906-01-01'},
  ].map(station => ({...station, id:`knmi-${station.sourceId}`, provider:'knmi' as const, country:'nl' as const, timeZone:'Europe/Amsterdam'})),
];
