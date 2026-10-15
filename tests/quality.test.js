const test=require('node:test');
const assert=require('node:assert/strict');
const {reconcileCatches,countNew,cleanRecord}=require('../scripts/quality');
const {parseChowari}=require('../scripts/collect');

const boat={id:'boat',name:'かどや丸 釣果',region:'小浜湾',url:'https://example.com/boat'};
test('multiple squid species: never assign maika count to aori',()=>{
 const html='<p>釣行日：2026年10月13日(火) アオリイカ マイカ 合計2匹 アコウ 合計3匹 波高：低い。アオリイカ１人８・７・６・５。</p>';
 const rows=parseChowari(html,boat);
 assert.equal(rows.length,1);
 assert.equal(rows[0].catch_count,null);
 assert.equal(rows[0].count_basis,'unknown');
});
test('aori-only range still parses, without treating max as boat total',()=>{
 const rows=parseChowari('釣行日：2026年10月6日(火) アオリイカ 3～15匹 波高：低い。',boat);
 assert.equal(rows[0].catch_min,3);
 assert.equal(rows[0].catch_max,15);
 assert.equal(rows[0].count_basis,'per_angler_range');
});
test('overlapping events from a sliding feed are merged, not double-counted',()=>{
 const base={date:'2026-10-13',source:'エギCOM 小浜',angler:'test',mode:'shore',region:'小浜湾',place_type:'磯',claimed_count:null,catch_count:2,confirmed_events:2,source_url:'https://example.com/1'};
 const rows=[
 {...base,id:'session-A',event_ids:['event-1','event-2'],time:'16:00〜16:10'},
 {...base,id:'session-B',event_ids:['event-2','event-3'],time:'16:10〜16:20'},
 {...base,id:'session-C',event_ids:['event-5'],time:'18:30'}
 ];
 const result=reconcileCatches(rows,[],'2026-09-16');
 assert.equal(result.length,2);
 const merged=result.find(x=>x.confirmed_events===3);
 assert.equal(merged.catch_count,3);
 assert.equal(merged.cpue,null);
 assert.equal(merged.duration_hours,null);
 assert.deepEqual(merged.event_ids,['event-1','event-2','event-3']);
 assert.equal(countNew(rows,result,'エギCOM 小浜'),0);
 assert.equal(reconcileCatches(result,[],'2026-09-16').length,2);
});
test('new event in existing session is counted once for ingest status',()=>{
 const old=[{id:'session-a',source:'エギCOM 敦賀',event_ids:['ev-1'],date:'2026-10-15',mode:'shore',region:'敦賀',angler:'A',place_type:'磯',catch_count:1}];
 const incoming=[{...old[0],id:'session-b',event_ids:['ev-1','ev-2'],catch_count:2}];
 const now=reconcileCatches(old,incoming,'2026-09-16');
 assert.equal(now.length,1);
 assert.equal(countNew(old,now,'エギCOM 敦賀'),1);
});
test('old cross-species misattribution is corrected even before re-fetch',()=>{
 const r=cleanRecord({source:'かどや丸 釣果',count_basis:'boat_total',count_source:'boat_report',catch_count:2,notes:'アオリイカ マイカ 合計2匹 アコウ 合計3匹'});
 assert.equal(r.catch_count,null);
 assert.equal(r.count_source,'report_only');
});
test('different anglers with identical event names are not accidentally merged',()=>{
 const rows=['A','B'].map(angler=>({id:angler,event_ids:['same'],date:'2026-10-13',source:'エギCOM',angler,mode:'shore',region:'小浜湾',place_type:'磯'}));
 assert.equal(reconcileCatches(rows,[],'2026-09-16').length,2);
});
