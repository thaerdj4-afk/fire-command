const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const st=html.indexOf('/* Multi-sector worker assignment'),end=html.indexOf('function renderSectorSetup(){',st);
assert(st>=0&&end>st,'bulk sector module must be present');
const code=html.slice(st,end);
for(const id of ['bulkSectorTabs','bulkSectorSearch','bulkSectorList','bulkSectorAssigned','bulkSectorAvailableCount','bulkSectorSave','bulkSectorSummary','bulkSectorStatus'])assert(html.includes('id="'+id+'"'),'Missing '+id);
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.style={};this.textContent='';this.value='';this.scrollTop=0;this.disabled=false;this.checked=false}
 append(...children){this.children.push(...children)}
 replaceChildren(...children){this.children=[...children]}
 setAttribute(name,value){this.attributes[name]=String(value)}
}
const elements={};const $=id=>elements[id]||(elements[id]=new Element());
const db=Array.from({length:50},(_,i)=>({id:'w'+(i+1),name:'Worker '+(i+1),event_id:'fire-1',sector:null,status:'בדרך'}));
let notices=[],writes=0;
const cloud={from(table){
 if(table==='worker_requests')return {insert:async rows=>{notices.push(...rows);return {error:null}}};
 assert.equal(table,'workers');
 return {
  mode:'read',ids:[],destination:null,
  select(){return this},eq(){return this},neq(){return this},
  update(values){this.mode='update';this.destination=values.sector;return this},
  in(field,ids){assert.equal(field,'id');this.ids=ids;return this},
  then(resolve,reject){let response;
   if(this.mode==='read')response={data:db.map(x=>({...x})),error:null};
   else {writes++;for(const w of db.filter(x=>this.ids.includes(x.id)))w.sector=this.destination;response={data:db.filter(x=>this.ids.includes(x.id)).map(w=>({id:w.id})),error:null}}
   return Promise.resolve(response).then(resolve,reject);
  }
 };
}};
const c={document:{createElement:tag=>new Element(tag)},$,ev:{id:'fire-1'},workers:db.map(x=>({...x})),sectorNames:()=>['א','ב','ג'],sectorPosition:()=>null,sectorConfig:()=>({manager:''}),cloud,live:async()=>{},confirm:()=>true,alert:msg=>{throw Error(msg)}};
vm.createContext(c);
const handlers=vm.runInContext(code+'\n({renderBulkSector,saveBulkSectorAssignments})',c);
function rowFor(id){return elements.bulkSectorList.children.find(x=>x.children?.[0]?.dataset?.workerId===id)}
function zoneChip(zone,id){
 const sector=elements.bulkSectorAssigned.children.find(x=>x.children[0].children[0].textContent==='📍 גזרה '+zone);
 assert(sector,'missing sector '+zone);
 return sector.children[1].children.find(x=>x.children?.[0]?.textContent===db.find(w=>w.id===id)?.name);
}
function selectZone(zone){
 const tab=elements.bulkSectorTabs.children.find(x=>x.textContent.startsWith('גזרה '+zone+' ('));
 assert(tab,'missing zone tab '+zone);tab.onclick();
}
function selectWorkers(zone,ids){
 selectZone(zone);
 for(const id of ids){
  const row=rowFor(id);assert(row,'worker '+id+' unavailable while assigning zone '+zone);
  const check=row.children[0];check.checked=true;check.onchange();
  assert.equal(rowFor(id),undefined,'selected worker should disappear from available list');
 }
}
function removeFromZone(zone,id){
 const chip=zoneChip(zone,id);assert(chip,'worker '+id+' missing under sector '+zone);
 chip.children[1].onclick();
}
function zoneCount(zone,n){
 const button=elements.bulkSectorTabs.children.find(x=>x.textContent.startsWith('גזרה '+zone+' ('));
 assert(button?.textContent.includes('('+n+')'),'count for '+zone+' is not '+n);
}
(async()=>{
 handlers.renderBulkSector();
 assert.equal(elements.bulkSectorList.children.length,50,'initial 50 unassigned workers');
 selectWorkers('א',db.slice(0,10).map(w=>w.id));
 zoneCount('א',10);
 selectZone('ב');
 for(const w of db.slice(0,10))assert.equal(rowFor(w.id),undefined,'A worker must be hidden in B');
 assert.equal(zoneChip('א','w1').children[0].textContent,'Worker 1');
 selectWorkers('ב',db.slice(10,13).map(w=>w.id));
 selectWorkers('ג',db.slice(13,21).map(w=>w.id));
 handlers.renderBulkSector(); // Realtime re-render must not clear drafts.
 for(const [zone,n] of [['א',10],['ב',3],['ג',8]])zoneCount(zone,n);
 assert.equal(elements.bulkSectorList.children.length,29,'remaining 29 unassigned workers');
 assert.match(elements.bulkSectorAvailableCount.textContent,/29/);
 assert.equal(elements.bulkSectorAssigned.children.length,3,'lists for all sectors');
 assert.equal(elements.bulkSectorSave.disabled,false);
 console.log('PASS 50 workers: 10 in A, 3 in B, 8 in C; only 29 remain selectable and each zone displays its own names');

 // Search only unassigned workers: even exact name of allocated worker is not shown.
 elements.bulkSectorSearch.value='Worker 1';
 elements.bulkSectorSearch.oninput();
 assert.equal(rowFor('w1'),undefined,'allocated member appeared in search results');
 elements.bulkSectorSearch.value='';elements.bulkSectorSearch.oninput();
 await handlers.saveBulkSectorAssignments();
 assert.equal(writes,3,'group one update per sector');
 assert.equal(notices.length,21,'notify each chosen worker');
 for(const [sector,n] of [['א',10],['ב',3],['ג',8]])assert.equal(db.filter(w=>w.sector===sector).length,n);
 assert.equal(elements.bulkSectorSave.disabled,true);
 console.log('PASS grouped save preserved 10 / 3 / 8 and sends 21 in-app messages');

 // To move A -> B, remove from A chip first; then choose from currently-unassigned list in B.
 selectZone('ב');
 assert.equal(rowFor('w1'),undefined,'assigned worker must remain hidden in B');
 removeFromZone('א','w1');
 assert(rowFor('w1'),'removed A worker should become available');
 selectWorkers('ב',['w1']);
 zoneCount('א',9);zoneCount('ב',4);
 await handlers.saveBulkSectorAssignments();
 assert.equal(db.find(w=>w.id==='w1').sector,'ב');
 assert.equal(notices.length,22);
 console.log('PASS remove from A list, reassign to B, never place worker in two sectors');

 // Click X in B, then save unassignment.
 removeFromZone('ב','w1');
 assert(rowFor('w1'),'removed worker should return to unassigned list');
 await handlers.saveBulkSectorAssignments();
 assert.equal(db.find(w=>w.id==='w1').sector,null);
 assert.equal(notices.at(-1).request_type,'שיבוץ לגזרה');
 assert.equal(JSON.parse(notices.at(-1).details.slice(14)).sector,'');
 console.log('PASS remove from zone list and save unassignment safely');

 const workerSource=fs.readFileSync(path.join(__dirname,'../worker.html'),'utf8');
 assert(workerSource.includes("typeof a.sector==='string'"));
 assert(workerSource.includes("'השיבוץ לגזרה בוטל'"));
 assert(workerSource.includes("assignment.lat!=null&&assignment.lng!=null"));
 for(const doc of [html,workerSource])for(const m of doc.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 console.log('PASS HQ and worker scripts compile');
})().catch(e=>{console.error(e);process.exitCode=1});
