// Run with linkedom available on NODE_PATH. No network requests or analytics hits.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'cap-rate-explorer.html'),'utf8');
const {document,window}=parseHTML(html);
Object.defineProperty(window.HTMLSelectElement.prototype,'value',{
 get(){const o=this.querySelector('option[selected]')||this.querySelector('option');return o?.getAttribute('value')??o?.textContent??'';},
 set(value){for(const o of this.querySelectorAll('option')){o.removeAttribute('selected');if((o.getAttribute('value')??o.textContent)===String(value))o.setAttribute('selected','');}}
});
window.HTMLElement.prototype.focus=function(){};
window.HTMLElement.prototype.scrollIntoView=function(){};
window.innerWidth=1280;
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
vm.runInNewContext(scripts.at(-1)[1],{document,window,Intl,console});
const $=id=>document.getElementById(id);
const change=(id,value,type='change')=>{$(id).value=String(value);$(id).dispatchEvent(new window.Event(type));};
const click=id=>$(id).dispatchEvent(new window.Event('click',{bubbles:true}));
const text=id=>$(id).textContent;
const D=JSON.parse($('course-data').textContent),T=D.treasury;
const checkSvg=()=>{for(const id of ['historyChart','localChart','valueChart'])assert(!/NaN|Infinity|undefined/.test($(id).innerHTML),id);};
assert.deepEqual(T,JSON.parse(fs.readFileSync(path.join(root,'_data/treasury-10y-quarterly.json'),'utf8')));
assert.equal(T.rates.length,79);assert.deepEqual(T.periods,D.periods);
assert(Math.abs(T.rates[78]-0.039546875)<1e-12);
assert.equal(T.observations.reduce((a,b)=>a+b,0),4942);
assert(text('historyStats').includes('3.95%'));assert(text('historyStats').includes('4.88%'));
assert.equal($('historyChart').querySelectorAll('.series-line').length,3);
assert(text('historyLegend').includes('10-year Treasury'));
assert.equal($('historyTable').querySelectorAll('tr')[0].children[2].textContent,'+93 bp');
click('metricSpread');assert.equal($('metricSpread').getAttribute('aria-pressed'),'true');
assert.equal($('historyChart').querySelectorAll('.series-line').length,2);
assert.equal($('historyChart').querySelectorAll('.zero-line').length,1);
change('marketA','Los Angeles');change('inspectQuarter',5,'input');
assert(text('historyTable').includes('−39 bp'));
assert([...$('historyChart').querySelectorAll('text')].some(t=>/^-[0-9]/.test(t.textContent)));
change('periodStart',5);change('inspectQuarter',5,'input');
assert([...$('benchmarkChanges').querySelectorAll('td')].every(e=>e.textContent==='0 bp'));
change('inspectQuarter',78,'input');
assert(text('benchmarkPeriod').includes('2006 Q2 → 2024 Q3'));
// The displayed decomposition must reconcile within one basis point of rounding.
for(const row of $('benchmarkChanges').querySelectorAll('tr')){
 const values=[...row.querySelectorAll('td')].map(e=>Number(e.textContent.replace('−','-').replace(' bp','')));
 assert(Math.abs(values[0]-values[1]-values[2])<=1);
}
click('metricValue');assert.equal($('historyChart').querySelectorAll('.series-line').length,2);
assert(!text('historyLegend').includes('Treasury'));
assert(text('historyTitle').includes('NOI'));
click('localExample');checkSvg();
// Transfers must use a property cap rate, even when the spread view is selected.
click('metricSpread');change('marketA','Orange County');change('comparison','sectors');
$('historyTable').querySelector('button').dispatchEvent(new window.Event('click',{bubbles:true}));
assert.equal($('baseCap').value,'4.88');assert.equal($('value').hidden,false);
click('tab-local');assert.equal($('localDetails').hasAttribute('open'),false);
for(const sector of ['Apartment','Office'])for(const market of ['Orange County','Los Angeles','Boston','New York']){
 change('localSector',sector);change('localMarket',market);checkSvg();
 assert(text('localTreasuryNote').includes('3.95%'));
 assert($('localChart').innerHTML.includes('10-year Treasury'));
}
// All selectors and intervals remain valid under each chart measure.
click('tab-history');
for(const metric of ['metricRate','metricSpread','metricValue'])for(const market of Object.keys(D.sectors.Apartment.history)){
 click(metric);change('marketA',market);checkSvg();
}
change('periodStart',78);assert.equal($('periodStart').value,'77');
change('periodEnd',0);assert.equal($('periodEnd').value,'1');checkSvg();
assert(!/green\s?street/i.test(html));
assert(!$('geography'));assert(!$('localSearch'));
// Reproduce the valuation overflow: a wide SVG previously kept its 670px viewBox.
click('tab-value');
for(const width of [320,390,670,1080,1440]){
 Object.defineProperty($('valueChart'),'clientWidth',{configurable:true,value:width});
 for(const [cap,shift,noiShift] of [[5,100,0],[5,-100,10],[30,300,50],[.1,0,-50]]){
  change('baseCap',cap,'input');change('capShift',shift,'input');change('noiShift',noiShift,'input');
  const bounds=$('valueChart').getAttribute('viewBox').split(' ').map(Number);
  const pts=[...$('valueChart').querySelector('.series-line').getAttribute('d').matchAll(/[ML]([\d.]+),([\d.]+)/g)];
  assert(pts.length>100);
  assert(pts.every(p=>+p[1]>=0&&+p[1]<=bounds[2]&&+p[2]>=0&&+p[2]<=bounds[3]),'Curve leaves its drawing area at width '+width);
  const gridRight=+$('valueChart').querySelector('.grid').getAttribute('x2');
  assert(gridRight<=bounds[2],'Grid leaves its drawing area');
  assert(Math.abs(+pts.at(-1)[1]-gridRight)<.02,'Curve should end at the right edge of the grid');
  assert([...$('valueChart').querySelectorAll('circle')].every(p=>+p.getAttribute('cx')<=bounds[2]),'Scenario point leaves its drawing area');
  checkSvg();
 }
}
console.log('PASS: quarterly benchmark, negative spreads, change decomposition, all markets, valuation transfer, collapsed details, and valuation curve bounds at five widths.');
