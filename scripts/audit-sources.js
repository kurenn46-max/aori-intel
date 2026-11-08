'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {summarize}=require('../source-balance');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/catches.json'),'utf8'));
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
console.log('AORI INTEL SOURCE DIVERSITY AUDIT (last 7 days / shore only / confirmed records)');
for(const region of ['全地域','高浜','小浜湾','常神半島','美浜','敦賀','舞鶴','宮津','越前']){
 const s=summarize(data,{today,region,days:7});
 const rate=s.share==null?'N/A':s.share+'%';
 console.log(region+': rows='+s.total+', egicom='+s.egicom+', non-egicom='+s.independent+', dependency='+rate+', independent_source_types='+s.independentSources.length+', status='+s.status);
}
console.log('NOTE: counts reflect reporting coverage, not catch probability or squid abundance.');
