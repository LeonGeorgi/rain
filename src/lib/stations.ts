export const stations = [
  {id:'47662', name:'Tokyo', jp:'東京', pref:'44'},
  {id:'47759', name:'Kyoto', jp:'京都', pref:'61'},
  {id:'47772', name:'Osaka', jp:'大阪', pref:'62'},
  {id:'47412', name:'Sapporo', jp:'札幌', pref:'14'},
  {id:'47807', name:'Fukuoka', jp:'福岡', pref:'82'},
  {id:'47936', name:'Naha', jp:'那覇', pref:'91'},
];

export type Station = (typeof stations)[number];
