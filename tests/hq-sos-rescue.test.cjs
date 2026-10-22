const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const workerHTML=fs.readFileSync(path.join(__dirname,'../worker.html'),'utf8');
const start=html.indexOf('/* SOS: only current-event positions'),end=html.indexOf('function reqReply(x){',start);
assert(start>=0&&end>start,'missing SOS nearest responder module');
for(const id of ['dangerClosest','dangerDispatch','dangerRescueFeedback'])assert(html.includes('id="'+id+'"'),'missing '+id);
const now=Date.now(),elements={},dispatches=[],focuses=[],lines=[],alerts=[];
const $=id=>elements[id]||(elements[id]={textContent:'',style:{},disabled:false});
const goodTime=new Date(now-10000).toISOString(),staleTime=new Date(now-600000).toISOString();
const workers=[
 {id:'person',event_id:'event-1',name:'Injured',status:'עובד בשריפה',latitude:33.273,longitude:35.761,location_updated_at:goodTime},
 {id:'a',event_id:'event-1',name:'Nearest',status:'עובד בשריפה',latitude:33.2734,longitude:35.761,location_updated_at:goodTime},
 {id:'stale',event_id:'event-1',name:'Outdated',status:'עובד בשריפה',latitude:33.27301,longitude:35.761,location_updated_at:staleTime},
 {id:'other-event',event_id:'event-2',name:'Other event',status:'עובד בשריפה',latitude:33.27301,longitude:35.761,location_updated_at:goodTime},
 {id:'ended',event_id:'event-1',name:'Finished',status:'סיים',latitude:33.27301,longitude:35.761,location_updated_at:goodTime},
 {id:'b',event_id:'event-1',name:'Second',status:'בדרך',latitude:33.274,longitude:35.761,location_updated_at:goodTime}
];
const ctx={
 Date,workers,ev:{id:'event-1'},requests:[{id:'sos-1',event_id:'event-1',worker_name:'Injured',request_type:'SOS / סכנה',status:'חדש',details:'LOC|33.273|35.761|'}],
 $,
 reqForEvent(){return ctx.requests.filter(r=>r.event_id===ctx.ev?.id)},
 map:{distance(a,b){const R=6371000,p=(b[0]-a[0])*Math.PI/180,q=(b[1]-a[1])*Math.PI/180;return Math.hypot(p*R,q*R*Math.cos(a[0]*Math.PI/180))},setView(point,zoom){focuses.push({point,zoom})}},
 L:{divIcon:o=>o,marker:()=>({addTo(){return this}}),polyline:(points,opts)=>{lines.push({points,opts});return{addTo(){return this}}}},
 sosLayer:{clearLayers(){}},
 esc:x=>String(x).replace(/</g,'&lt;'),
 cloud:{from(name){assert.equal(name,'worker_requests');return{async insert(row){dispatches.push(row);return{error:null}}}}},
 confirm(){return true},alert(x){alerts.push(x)},navigator:{clipboard:{writeText:async()=>{}}}
};
vm.createContext(ctx);
const api=vm.runInContext(html.slice(start,end)+'\n({renderSOS,nearestSOSWorkers,sosPosition,validSOSPoint})',ctx);
(async()=>{
 api.renderSOS();
 assert.match(elements.dangerClosest.textContent,/Nearest/);
 assert.doesNotMatch(elements.dangerClosest.textContent,/Outdated|Other event|Finished|Injured/);
 assert.equal(elements.dangerDispatch.disabled,false);
 assert.equal(lines.length,1,'connect nearest and SOS with dotted line');
 assert.equal(focuses.length,1,'focus only on the new SOS');
 api.renderSOS();assert.equal(focuses.length,1,'do not repeatedly hijack map view');
 await elements.dangerDispatch.onclick();
 assert.equal(dispatches.length,1);
 assert.equal(dispatches[0].worker_name,'Nearest');
 assert.equal(dispatches[0].request_type,'הודעה מהחפ״ק');
 assert.deepEqual([JSON.parse(dispatches[0].details.slice(11)).lat,JSON.parse(dispatches[0].details.slice(11)).lng],[33.273,35.761]);
 console.log('PASS SOS location, nearest fresh GPS helper, stale/excluded filtering, map focus and one manual dispatch');

 ctx.workers=workers.filter(w=>w.id==='person').map(w=>({...w,latitude:null,longitude:null}));
 ctx.requests=[{id:'sos-2',event_id:'event-1',worker_name:'Injured',request_type:'SOS / סכנה',status:'חדש',details:''}];
 api.renderSOS();
 assert.equal(elements.dangerDispatch.disabled,true);
 assert.match(elements.dangerMeta.textContent,/מיקום לא זמין/);
 assert.match(elements.dangerClosest.textContent,/אי אפשר לחשב/);
 console.log('PASS SOS still visible with no GPS; nearest responder is not invented');

 const inboxStart=workerHTML.indexOf('function renderInbox(){'),inboxEnd=workerHTML.indexOf('async function poll(){',inboxStart);
 assert(inboxStart>=0&&inboxEnd>inboxStart,'worker rescue inbox missing');
 function workerCheck(detail){
  const widgets={};const get=id=>widgets[id]||(widgets[id]={hidden:true,textContent:'',disabled:false,href:'',replaceChildren(){},append(){},removeAttribute(k){if(k==='href')this.href=''}});
  const app={
   inbox:[{id:'msg-1',request_type:'הודעה מהחפ״ק',details:detail}],sessionKey:'event-1',
   $:get,localStorage:{getItem(){return null}},text(id,v){get(id).textContent=v},reply(){return null},
   request:async()=>{},document:{createElement:()=>({})}
  };
  vm.createContext(app);vm.runInContext(workerHTML.slice(inboxStart,inboxEnd)+'\nrenderInbox()',app);
  return widgets;
 }
 const res=workerCheck('SOS_RESCUE|'+JSON.stringify({person:'Injured',lat:33.273,lng:35.761}));
 assert.equal(res.rescueCard.hidden,false);
 assert.equal(res.rescueNavigate.hidden,false);
 assert.match(res.rescueNavigate.href,/33\.273/);
 const invalid=workerCheck('SOS_RESCUE|'+JSON.stringify({person:'Injured',lat:null,lng:null}));
 assert.equal(invalid.rescueCard.hidden,true);
 console.log('PASS worker sees rescue request and valid navigation but no fake coordinates');
 for(const doc of [html,workerHTML])for(const m of doc.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 console.log('PASS worker and HQ scripts compile');
})().catch(error=>{console.error(error);process.exitCode=1});
