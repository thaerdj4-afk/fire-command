const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const initStart=html.indexOf('const map=L.map('),initEnd=html.indexOf('window.__hqMap=map;',initStart);
assert(initStart>=0&&initEnd>initStart,'map setup missing');
const mapInit=html.slice(initStart,initEnd+'window.__hqMap=map;'.length);
const eventInit=html.slice(html.indexOf('let eventStartBusy='),html.indexOf('async function finish(){'));
assert(mapInit.includes('windLayer=L.layerGroup().addTo(map)'),'windLayer must be initialized before restoring events');
const eventRow={id:'event-100059',event_number:100059,name:'אירוע שריפה',status:'active',started_at:'2026-10-22T19:00:23.524Z'};
const elements={},rows=[eventRow];let clears=0,rendered=0;
const c={
 window:{},Date,ev:null,started:null,restoreEpoch:0,workers:[],requests:[],stack:[],lastWorkersSig:'',lastRequestsSig:'',lastAuxLoad:0,lastFireAreaM2:0,
 mapLayers:{clear(){}},sosLayer:{clearLayers(){}},
 L:{
  map:()=>({setView(){return this}}),
  featureGroup:()=>({addTo(){return this},clearLayers(){}}),
  layerGroup:()=>({addTo(){return this},clearLayers(){clears++}})
 },
 document:{activeElement:null,createElement(){return {value:'',textContent:''}}},
 $:id=>elements[id]||(elements[id]={replaceChildren(){this.options=[]},append(x){this.options.push(x)},hidden:false,value:'',textContent:''}),
 recountMap(){},renderWorkers(){},renderSOS(){},showLivePanels(){},link(){rendered++},async syncMap(){},async live(){},rt(){},alert(){},
 cloud:{from(){return {select(){return this},eq(){return this},order(){return Promise.resolve({data:rows,error:null})}}}}
};
const {restore}=new Function('c','with(c){'+mapInit+'\n'+eventInit+'\nreturn {restore};}')(c);
(async()=>{
 await restore();
 assert.equal(c.ev?.event_number,100059,'existing event must load');
 assert.equal(elements.activeEventPickerWrap.hidden,false,'existing event must be visible');
 assert.match(elements.estate.textContent,/100059/);
 assert(clears>0,'wind overlay must be cleared');
 assert.equal(rendered,1,'active event data must reach worker link');
 console.log('PASS previously saved fire event #100059 loads after page refresh with a valid wind layer');
})().catch(e=>{console.error(e);process.exitCode=1});
