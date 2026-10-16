const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom'),source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const {document}=parseHTML(source).window;const main=[...document.querySelectorAll('script:not([src])')].map(x=>x.textContent).find(x=>x.includes('async function detectFuelAt'));
let sample={at_point:{type:'עשבוני',factor:1.25,code:30},nearby:[]},pending=null,fail=false;
const c={document,$:id=>document.getElementById(id),esc:x=>String(x),window:{HQRegionalCover:{load:()=>pending||Promise.resolve({}),sample:()=>{if(fail)throw Error('unavailable');return sample}}}};
vm.createContext(c);vm.runInContext(main.slice(main.indexOf('let hqFuel='),main.indexOf('function fireRiskLevel(')),c);
(async()=>{
 const timer=document.getElementById('time').closest('.hw');assert.equal(timer.nextElementSibling.id,'headerFuelBadge');
 const initial=c.detectFuelAt(32,35);assert.equal(document.getElementById('headerFuelBadge').getAttribute('aria-busy'),'true');await initial;
 assert.equal(document.getElementById('headerFuelType').textContent,'עשבוני');assert.equal(document.getElementById('headerFuelBadge').getAttribute('aria-busy'),'false');
 c.renderFuelBadge('waiting');await c.detectFuelAt(32,35);assert.equal(document.getElementById('headerFuelType').textContent,'עשבוני');
 fail=true;await c.detectFuelAt(33,36);assert.equal(document.getElementById('headerFuelType').textContent,'לא ידוע');fail=false;
 let finish;pending=new Promise(r=>finish=r);const stale=c.detectFuelAt(34,37);c.resetFuelBadge();finish({});await stale;
 assert.equal(document.getElementById('headerFuelType').textContent,'סמן מוקד אש');
 assert.equal(JSON.parse(document.documentElement.dataset.hqFuel).type,'לא ידוע');
 console.log('PASS vegetation next to timer: loading, class, cached class, unavailable and stale-result reset');
})().catch(e=>{console.error(e);process.exitCode=1});
