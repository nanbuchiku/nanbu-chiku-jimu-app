export const CHAPTERS = [
  { id:"todawarabi",    name:"とだわらび", short:"とだわらび",  day:2, dayName:"火曜日", color:"#1B5E20", light:"#E8F5E9", accent:"#A5D6A7",
    time:"AM6:00〜7:00", venue:"戸田市商工会館", address:"戸田市上戸田１−２１−２３", venueTel:"０４８−４４１−２６１７", mapUrl:"https://share.google/LBrDQ6899ccNm89hv", staff:"" },
  { id:"kawaguchi_east",name:"川口東",     short:"川口東",  day:3, dayName:"水曜日", color:"#1A3A6B", light:"#E3F2FD", accent:"#90CAF9",
    time:"AM6:00〜7:00", venue:"川口緑化センター　樹里安", address:"川口安行領家８４４−２", venueTel:"―", mapUrl:"https://share.google/7QSKHBQCh0the5Cb7", staff:"" },
  { id:"niizashiki",    name:"新座・志木", short:"新座志木",day:4, dayName:"木曜日", color:"#6D4C9F", light:"#EDE7F6", accent:"#B39DDB",
    time:"AM6:00〜7:00", venue:"CKスクエア新座　６F", address:"新座市野火止５−２−１０（駐車場：４F無料）", venueTel:"―", mapUrl:"https://share.google/rSXTQ2jqiGDttsCyE", staff:"小林靖会長" },
  { id:"asaka",         name:"朝霞",       short:"朝霞",    day:5, dayName:"金曜日", color:"#BF360C", light:"#FFF3E0", accent:"#FFCC80",
    time:"AM6:30〜7:30", venue:"浜崎会館　２Fホール（氷川神社境内）", address:"朝霞市浜崎３丁目９番地", venueTel:"―", mapUrl:"https://maps.app.goo.gl/phdDu7hZSuUbmErN6", staff:"" },
  { id:"kawaguchi",     name:"川口",       short:"川口",    day:6, dayName:"土曜日", color:"#B71C1C", light:"#FFEBEE", accent:"#EF9A9A",
    time:"AM6:30〜7:30", venue:"元郷四丁目町会会館", address:"川口市元郷４丁目１２−２（駐車場：（株）もといち　川口市元郷４−８−２４）", venueTel:"―", mapUrl:"https://share.google/nIYPjDL6MsMpt1ek8", staff:"" },
];

export const JIMU = { email:"nanbugoudou.jimu@gmail.com", tel:"" };

export const STATUS = {
  pending:   { label:"依頼中",     color:"#FF8F00", bg:"#FFF8E1" },
  confirmed: { label:"確定",       color:"#2E7D32", bg:"#E8F5E9" },
  completed: { label:"終了",       color:"#546E7A", bg:"#ECEFF1" },
  cancelled: { label:"キャンセル", color:"#B71C1C", bg:"#FFEBEE" },
};

export const SEMINAR_TYPES = [
  { id:"ms",      label:"モーニングセミナー", short:"MS",   color:"#1A3A6B", venueFixed:true,  hasLodging:true  },
  { id:"kiso",    label:"倫理経営基礎講座",   short:"基礎", color:"#2E7D32", venueFixed:false, hasLodging:true  },
  { id:"tsudoi",  label:"経営者の集い",       short:"集い", color:"#4E342E", venueFixed:false, hasLodging:true  },
  { id:"evening", label:"イブニングセミナー", short:"イブ", color:"#37474F", venueFixed:false, hasLodging:"optional" },
  { id:"koen",    label:"倫理経営講演会",     short:"倫経", color:"#7B0000", venueFixed:false, hasLodging:true  },
];

export const DISTRICT_ID = '11111111-1111-1111-1111-111111111111';
