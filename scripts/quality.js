'use strict';
const crypto = require('crypto');
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0,16);
const uniq = xs => [...new Set(xs)];

function cleanRecord(x) {
  const row = { ...x };
  // Event posting timestamps are not fishing start/end timestamps.
  if (row.event_ids?.length) {
    row.duration_hours = null;
    row.cpue = null;
  }
  // Legacy parsing could misattribute a different squid's quantity to aori.
  if (row.source?.includes('かどや丸') &&
      /アオリイカ\s+マイカ\s+合計\s*\d+\s*匹/.test(row.notes||'') &&
      row.count_basis === 'boat_total') {
    row.catch_count = null;
    row.catch_min = null;
    row.catch_max = null;
    row.count_basis = 'unknown';
    row.count_source = 'report_only';
  }
  return row;
}

function mergeEventSessions(rows) {
  const parents = rows.map((_, i) => i);
  const root = i => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
  const join = (a,b) => {a=root(a);b=root(b);if(a!==b)parents[b]=a;};
  const owners = new Map();
  rows.forEach((r,i) => {
    const key = [r.source,r.angler,r.date,r.mode,r.region,r.place_type].join('|');
    for (const ev of r.event_ids || []) {
      const composite = key+'|'+ev;
      if (owners.has(composite)) join(i,owners.get(composite));
      else owners.set(composite,i);
    }
  });
  const groups = new Map();
  rows.forEach((r,i) => {const k=root(i), group=groups.get(k)||[];group.push(r);groups.set(k,group);});
  return [...groups.values()].map(group => {
    if (group.length===1) return group[0];
    const events=uniq(group.flatMap(r=>r.event_ids||[])).sort();
    if(!events.length) return group[0];
    const candidate=group.slice().sort((a,b)=>
      (b.event_ids?.length||0)-(a.event_ids?.length||0) ||
      (b.notes?.length||0)-(a.notes?.length||0))[0];
    const claimed=Math.max(0,...group.map(r=>Number(r.claimed_count)||0));
    const times=uniq(group.flatMap(r=>String(r.time||'').match(/\b\d{2}:\d{2}\b/g)||[])).sort();
    return {...candidate,
      id:'session-'+hash(events.join('|')),
      event_ids:events,confirmed_events:events.length,
      catch_count:Math.max(events.length,claimed),
      claimed_count:claimed||null,
      count_source:claimed>events.length?'claimed_ordinal':'posted_events',
      time:times.length>1?times[0]+'〜'+times.at(-1):times[0]||candidate.time,
      duration_hours:null,cpue:null
    };
  });
}

function reconcileCatches(oldRows, incomingRows, cutoffDate) {
  const historic=oldRows.filter(x=>x.is_user_data || (x.date&&x.date>=cutoffDate));
  // Latest scraped charter listing replaces earlier versions of the same dated listing,
  // including older wrong counts. Preserve old days absent from the current fetch.
  const byCharter=new Map();
  const others=[];
  for(const row of [...historic,...incomingRows].map(cleanRecord)){
    if(row.id?.startsWith('chowari-')) {
      const key=[row.source,row.date].join('|');
      const prev=byCharter.get(key);
      // Fresh, parsed record wins. Within one batch a count with a clear basis wins.
      if(!prev || (Number(row.catch_count!=null)-Number(prev.catch_count!=null))>=0) byCharter.set(key,row);
    } else others.push(row);
  }
  const events=others.filter(r=>Array.isArray(r.event_ids)&&r.event_ids.length);
  const simple=others.filter(r=>!Array.isArray(r.event_ids)||!r.event_ids.length);
  const byId=new Map();
  for(const row of [...simple,...mergeEventSessions(events),...byCharter.values()]) byId.set(row.id,row);
  return [...byId.values()].sort((a,b)=>
    (b.date+' '+(b.time||'')).localeCompare(a.date+' '+(a.time||'')));
}

function uniqueEventIds(rows) {
  return new Set(rows.flatMap(x=>x.event_ids||[]));
}
function countNew(oldRows, mergedRows, source) {
  const old=oldRows.filter(x=>x.source===source);
  const now=mergedRows.filter(x=>x.source===source);
  const oldEvents=uniqueEventIds(old);
  const addedEvents=new Set();
  for(const row of now) for(const ev of row.event_ids||[])
    if(!oldEvents.has(ev)) addedEvents.add(ev);
  if(addedEvents.size) return addedEvents.size;
  const ids=new Set(old.map(x=>x.id));
  return now.filter(x=>!rowHasEvents(x)&&!ids.has(x.id)).length;
}
function rowHasEvents(row){return Array.isArray(row.event_ids)&&row.event_ids.length>0;}
module.exports={cleanRecord,mergeEventSessions,reconcileCatches,countNew};
