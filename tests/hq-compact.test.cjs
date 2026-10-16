const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const {window}=parseHTML(source),document=window.document;
const scripts=[...document.querySelectorAll('script:not([src])')].map(x=>x.textContent);
for(const [i,s]of scripts.entries())new vm.Script(s,{filename:'inline-'+i});
const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);assert.equal(ids.length,new Set(ids).size);
assert.equal(document.querySelectorAll('#premiumLeft .toolGrid button').length,26);
for(const attr of ['data-p','data-l','data-a']){const values=[...document.querySelectorAll('#premiumLeft ['+attr+']')].map(b=>b.getAttribute(attr));assert.equal(values.length,new Set(values).size,attr+' has duplicate tools')}
for(const id of ['freeDraw','measureArea','measureDist','undo','erase','stopDraw','locate','unit','base','history','finish','clear','snapshot','workerLink','trustedInviteOpen','requests','workers','photosPanel'])assert(document.getElementById(id),id+' missing');
console.log('PASS all 26 unique tools, secondary features, IDs and script syntax retained');
const main=scripts.find(s=>s.includes('let activeSectorTab='));
const take=(a,b)=>main.slice(main.indexOf(a),main.indexOf(b,main.indexOf(a)));
let records=[],removed=[],alerts=[],confirmations=[],opened=[],sent=[];const storage=new Map();
const makeLayer=k=>({_kind:k,_id:k});const mapLayers=new Map([['A',makeLayer('sector א')],['B',makeLayer('sector ב')]]);
const c={console,document,window:null,$:id=>document.getElementById(id),esc:v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),
 ev:{id:'event1'},workers:[{id:'w1',name:'Worker One',status:'פעיל',sector:'ב'}],workerPhones:new Map([['Worker One','972500000000']]),mapLayers,pendingMap:new Set(),stack:[...mapLayers.values()],polyKind:null,polyPts:[],mode:null,lineKind:null,measureMode:null,freeDrawing:false,lastFireAreaM2:0,
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 sectorConfig:k=>({manager:'Manager '+k}),sectorPosition:k=>k==='ב'?[32.2,35.2]:[32.1,35.1],
 alert:t=>alerts.push(t),confirm:t=>(confirmations.push(t),true),matchMedia:()=>({matches:false}),
 map:{getContainer:()=>({style:{}})},stop:()=>{c.polyKind=null},ops:{removeLayer:l=>removed.push(l._kind)},recountMap:()=>{},renderWorkers:()=>{},
 setSectorPoint:k=>sent.push(['point',k]),setSectorManager:k=>sent.push(['manager',k]),sendSelectedWorkerToSector:k=>sent.push(['assign',k]),addCustomSector:()=>{},
 open:u=>opened.push(u),navigator:{share:async v=>sent.push(['share',v.text])},
 cloud:{from:table=>({delete:()=>({eq:(field,value)=>({in:async(field2,kinds)=>{records.push({table,field,value,field2,kinds});return {error:null}}})})})}
};c.window=c;vm.createContext(c);
vm.runInContext(take('function sectorNames()','window.addCustomSector='),c);
vm.runInContext(take('let activeSectorTab=','window.setSectorManager='),c);
vm.runInContext(take('const namesBeforeDelete = sectorNames;','  })();'),c);
vm.runInContext(document.getElementById('compact-hq-tabs').textContent,c);
assert.equal(document.getElementById('hqPane-workers').hidden,false);c.setHQTab('sectors');assert.equal(document.getElementById('hqPane-sectors').hidden,false);assert.equal(document.getElementById('hqPane-workers').hidden,true);
c.setHQTab('requests');assert.equal(document.getElementById('hqPane-requests').hidden,false);assert.equal(document.getElementById('hqTab-requests').getAttribute('aria-selected'),'true');
console.log('PASS right panel tabs show one pane and preserve controls');
(async()=>{
 c.selectSectorTab('ב');assert.equal(document.querySelector('#sectorSetup [data-sector-name]').getAttribute('data-sector-name'),'ב');
 document.getElementById('sectorBorder').onclick();assert.equal(c.polyKind,'sector ב');c.polyKind=null;
 document.getElementById('sectorPoint').onclick();document.getElementById('sectorManager').onclick();document.getElementById('sectorSend').onclick();assert.deepEqual(sent.slice(-3),[['point','ב'],['manager','ב'],['assign','ב']]);
 await document.getElementById('sectorDelete').onclick();assert.equal(records.length,0);assert(alerts.at(-1).includes('יש עובדים'));
 c.workers[0].sector='א';await document.getElementById('sectorDelete').onclick();assert.equal(records.length,1);assert.equal(records[0].value,'event1');assert.deepEqual(Array.from(records[0].kinds),['sector ב','sector-point ב']);assert(confirmations.at(-1).includes('ב'));assert(mapLayers.has('A'));assert(!mapLayers.has('B'));assert.deepEqual(removed,['sector ב']);
 console.log('PASS sector B actions target B; occupied sector deletion blocked; deleting B preserves A');
 // Recreate B for the sharing path without modifying a live event.
 mapLayers.set('B',makeLayer('sector ב'));storage.clear();c.selectSectorTab('ב');document.querySelector('#sectorWorkerPick option[value="w1"]').selected=true;
 document.getElementById('sectorWhatsApp').onclick();assert.equal(opened.length,1);const text=new URL(opened[0]).searchParams.get('text');assert(text.includes('גזרה ב'));assert(text.includes('32.200000,35.200000'));
 await document.getElementById('sectorGroupShare').onclick();assert(sent.at(-1)[1].includes('גזרה ב'));
 console.log('PASS WhatsApp and group sharing use selected sector B coordinates');
 c.prompt=()=> 'צפונית';vm.runInContext(take('window.addCustomSector=','let activeSectorTab='),c);c.addCustomSector();assert.equal(document.querySelector('#sectorSetup [data-sector-name]').getAttribute('data-sector-name'),'צפונית');assert.deepEqual(sent.at(-1),['point','צפונית']);
 console.log('PASS adding a custom sector opens its own tab before placing its point');

 vm.runInContext(take('function areaM2(','function showDist('),c);
 const R=6378137,deg=180/Math.PI,points=[{lat:0,lng:0},{lat:0,lng:100/R*deg},{lat:10/R*deg,lng:100/R*deg},{lat:10/R*deg,lng:0}];c.showArea(points);assert(document.getElementById('measureResult').textContent.includes('1.00 דונם'));assert(Math.abs(c.lastFireAreaM2-1000)<0.01);
 console.log('PASS 1,000 square meters displays 1.00 dunam');
 c.setTimeout=fn=>fn();c.map.invalidateSize=()=>{};let pointCallback=null,cancelled=0;
 c.map.once=(event,fn)=>{pointCallback=fn};c.map.off=(event,fn)=>{if(fn===pointCallback)cancelled++};c.map.dragging={enable:()=>{}};
 c.preview=null;c.linePts=[];c.freePts=[];c.measurePts=[];c.commitCurrent=()=>false;c.cancelFreeStroke=()=>{};
 vm.runInContext(take('function stop(){','function pMode('),c);
 vm.runInContext(take('window.setSectorPoint=k=>','window.sendSelectedWorkerToSector='),c);
 c.setSectorPoint('ב');assert(pointCallback);c.stop();assert.equal(cancelled,1);
 c.setSectorPoint('ב');const callback=pointCallback;c.ev={id:'event2'};const countBefore=records.length;callback({latlng:{lat:32.3,lng:35.3}});assert.equal(records.length,countBefore);assert(!storage.has('sector:event2:ב'));
 console.log('PASS cancelling point placement removes handler; switching events cannot save an old sector point');

})().catch(e=>{console.error(e);process.exitCode=1});
