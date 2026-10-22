const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const st=html.indexOf('/* Multi-sector worker assignment'),end=html.indexOf('function renderSectorSetup(){',st);
assert(st>=0&&end>st,'bulk sector module must be present');
const code=html.slice(st,end);
for(const id of ['bulkSectorTabs','bulkSectorSearch','bulkSectorList','bulkSectorSave','bulkSectorSummary','bulkSectorStatus'])assert(html.includes('id="'+id+'"'),'Missing '+id);
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.style={};this.textContent='';this.value='';this.scrollTop=0;this.disabled=false;this.checked=false}
 append(...children){this.children.push(...children)}
 replaceChildren(...children){this.children=[...children]}
 setAttribute(name,value){this.attributes[name]=String(value)}
}
const elements={};const $=id=>elements[id]||(elements[id]=new Element());
const db=Array.from({length:21},(_,i)=>({id:'w'+(i+1),name:'Worker '+(i+1),event_id:'fire-1',sector:null,status:'בדרך'}));
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
function setSector(k,ids){
 const tab=elements.bulkSectorTabs.children.find(x=>x.textContent.startsWith('גזרה '+k+' ('));assert(tab,'missing tab '+k);tab.onclick();
 for(const id of ids){
  const row=elements.bulkSectorList.children.find(x=>x.children?.[0]?.dataset?.workerId===id);assert(row,'worker '+id+' missing');
  row.children[0].checked=true;row.children[0].onchange();
 }
}
(async()=>{
 handlers.renderBulkSector();
 setSector('א',db.slice(0,10).map(x=>x.id));
 setSector('ב',db.slice(10,13).map(x=>x.id));
 setSector('ג',db.slice(13,21).map(x=>x.id));
 handlers.renderBulkSector(); // Realtime render must not clear unsaved checkboxes.
 for(const [sector,n] of [['א',10],['ב',3],['ג',8]])assert(elements.bulkSectorSummary.textContent.includes('גזרה '+sector+': '+n),sector+' count');
 await handlers.saveBulkSectorAssignments();
 assert.equal(writes,3,'group one DB update per sector');
 assert.equal(notices.length,21,'one notification per worker');
 for(const [sector,n] of [['א',10],['ב',3],['ג',8]])assert.equal(db.filter(w=>w.sector===sector).length,n);
 assert.equal(elements.bulkSectorSave.disabled,true,'nothing left to save');
 console.log('PASS 10 workers in A, 3 in B, 8 in C; only 3 grouped updates and 21 worker messages');

 // Change one worker from A to B; no double sector assignment.
 setSector('ב',['w1']);
 assert(elements.bulkSectorSummary.textContent.includes('גזרה א: 9'));
 assert(elements.bulkSectorSummary.textContent.includes('גזרה ב: 4'));
 await handlers.saveBulkSectorAssignments();
 assert.equal(db.find(w=>w.id==='w1').sector,'ב');
 assert.equal(notices.length,22);
 console.log('PASS worker can be moved between sectors without duplicate assignment');

 // Uncheck a worker and save an unassignment notification.
 const row=elements.bulkSectorList.children.find(x=>x.children?.[0]?.dataset?.workerId==='w1');
 row.children[0].checked=false;row.children[0].onchange();
 await handlers.saveBulkSectorAssignments();
 assert.equal(db.find(w=>w.id==='w1').sector,null);
 assert.equal(notices.at(-1).request_type,'שיבוץ לגזרה');
 assert.equal(JSON.parse(notices.at(-1).details.slice(14)).sector,'');
 console.log('PASS removing a worker from a sector clears saved assignment and notifies worker');

 const workerSource=fs.readFileSync(path.join(__dirname,'../worker.html'),'utf8');
 assert(workerSource.includes("typeof a.sector==='string'"),'worker app should accept assignment without coordinates');
 assert(workerSource.includes("'השיבוץ לגזרה בוטל'"),'worker app should show unassignment');
 assert(workerSource.includes("assignment.lat!=null&&assignment.lng!=null"),'worker navigation should require coordinates');
 for(const doc of [html,workerSource])for(const m of doc.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
 console.log('PASS both HQ and worker scripts compile; optional navigation and unassignment remain supported');
})().catch(e=>{console.error(e);process.exitCode=1});
