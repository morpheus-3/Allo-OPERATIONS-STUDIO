const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){const elements={},storage=new Map();const document={getElementById(id){return elements[id]??={value:'',textContent:'',innerHTML:'',hidden:false,className:''};}};
  const ctx=vm.createContext({document,Intl,console,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}});
  const html=fs.readFileSync('demo.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];vm.runInContext(script,ctx);return {ctx,elements,storage,run:s=>vm.runInContext(s,ctx)};}

test('weekly view agrees with workboard at cutoff and shows its selected week',()=>{
  const p=fixture();p.run("advance(1);setTab('weekly')");
  assert.equal(p.run('reportForView().overdue'),4);assert.equal(p.run('reportForView().dueCount'),4);
  assert.match(p.run("gaurangAnswer('Which tasks are overdue?',{now,settings:settingsState,tasks,cycles,history:recoveryHistory,mode:'demo'}).asOf"),/17:00 IST/);assert.equal(p.elements['week-start'].value,'2026-10-05');assert.equal(p.elements.stats.hidden,true);
  assert.match(p.elements.events.innerHTML,/Review requested/);
  p.run("setTab('workboard')");assert.equal(p.elements.stats.hidden,false);
});
test('preview completes and prepares next cycle using the shared engine',()=>{const p=fixture();p.run("draft(1,'Proof','P-100');complete(1)");assert.equal(p.run('cycles.length'),5);assert.equal(p.run('cycles[1].Proof'),'P-100');assert.equal(p.run('dayKey(cycles[4].DueAt)'),'2026-10-15');});
test('preview runs manager and leadership flows without repeated alerts',()=>{const p=fixture();p.run('advance(1);run()');assert.equal(p.run('events.length'),4);p.run("draft(0,'ManagerNote','Called employee');acknowledge(0);complete(0);advance(4);run()");assert.equal(p.run("events.filter(e=>e.stage==='LEADERSHIP').length"),3);});
test('preview tabs, employee filter, input escaping and persistence work',()=>{const p=fixture();p.run("draft(1,'Proof','<img src=x onerror=alert(1)>');setTab('alerts')");assert.equal(p.elements['work-panel'].hidden,true);assert.equal(p.elements['page-title'].textContent,'Escalation log');p.run("setTab('workboard')");assert.match(p.elements.rows.innerHTML,/&lt;img/);p.elements.person.value='Employee A';p.ctx.render();assert.doesNotMatch(p.elements.rows.innerHTML,/Portal Task A/);assert.ok(p.storage.get('allo-studio-v2'));p.run("setTab('manager')");assert.equal(p.elements['work-panel'].hidden,true);assert.equal(p.elements['manager-panel'].hidden,false);assert.match(p.elements['review-cards'].innerHTML,/No manager reviews/);p.run('advance(1)');assert.match(p.elements['review-cards'].innerHTML,/Acknowledge review/);assert.doesNotMatch(p.elements['review-cards'].innerHTML,/onclick="complete/);p.run("setTab('alerts')");p.elements['event-filter'].value='LEADERSHIP';p.ctx.render();assert.match(p.elements.events.innerHTML,/No activity matches/);});
test('preview blocks empty tickets and early future completion',()=>{const p=fixture();p.run('complete(1)');assert.match(p.elements.message.textContent,/Ticket ID/);p.run("draft(1,'Proof','T1');complete(1);draft(4,'Proof','T2');complete(4)");assert.equal(p.run('cycles.length'),5);assert.match(p.elements.message.textContent,/not due/);});

test('preview recovery drawer saves versions after review without duplicating unchanged plans',()=>{
  const p=fixture();p.run("advance(1);draft(1,'ManagerNote','Contacted owner');acknowledge(1);openRecovery(1)");
  for(const [id,value] of [['r-blocker','Portal outage'],['r-owner','Employee B'],['r-target','2026-10-09T11:00'],['r-action','Retry portal']])p.elements[id].value=value;
  p.run('saveRecoveryDraft()');assert.equal(p.run('recoveryHistory.length'),1);assert.equal(p.run('cycles[1].CompletedAt'), '');assert.match(p.elements['review-cards'].innerHTML,/Review acknowledged/);assert.match(p.elements['review-cards'].innerHTML,/Task still open/);assert.equal(p.run("cycles.filter(c=>c.CompletedAt).length"),0);
  p.run('openRecovery(1);saveRecoveryDraft()');assert.equal(p.run('recoveryHistory.length'),1);
  p.elements['r-action'].value='<script>bad()</script>';p.run('saveRecoveryDraft();openRecovery(1)');
  assert.equal(p.run('recoveryHistory.length'),2);assert.match(p.elements['recovery-history'].innerHTML,/&lt;script/);
  assert.equal(p.run('recoveryHistory[0].NextAction'),'Retry portal');
});
test('frontend scenarios, weekly reporting, policy changes and holiday controls use shared rules',()=>{
  const p=fixture();p.run("loadScenario('week');setTab('weekly')");assert.equal(p.elements['weekly-panel'].hidden,false);
  assert.equal(p.run('reportForView().carryover'),1);assert.match(p.elements['blocker-rows'].innerHTML,/Supplier dependency/);
  assert.match(p.run('weeklyCSV()'),/Due denominator/);
  p.run("reset();setTab('settings')");p.elements.holidays.value='2026-10-09';p.run('saveCalendar();complete(0)');
  assert.equal(p.run('dayKey(cycles[4].DueAt)'),'2026-10-12');
  p.run("loadScenario('coverage')");assert.equal(p.run('cycles[0].ReviewOwnerEmail'),'backup@demo.test');
  p.run("setTaskPolicy(1,'RecurrenceMode','FIXED')");assert.equal(p.run('tasks[1].RecurrenceMode'),'FIXED');
  p.run("setTab('workboard')");p.elements['task-search'].value='no such task';p.ctx.render();assert.match(p.elements.rows.innerHTML,/No tasks match/);
});
test('template and generated frontend expose unique IDs and local-simulation boundaries',()=>{
  const html=fs.readFileSync('demo.html','utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  // Static IDs only; dynamic input IDs are created by render functions at runtime.
  const staticHTML=html.split('<script>')[0],staticIds=[...staticHTML.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(staticIds).size,staticIds.length);assert.ok(ids.length>40);
  assert.match(html,/aria-modal="true"/);assert.match(html,/prefers-reduced-motion/);assert.match(html,/does not connect to the Sheet/);
  const p=fixture();p.run("setTab('settings');setTab('weekly');setTab('overview')");assert.equal(p.elements['overview-panel'].hidden,false);
});
test('standalone build preserves source replacement tokens and CSV neutralizes spreadsheet formulas',()=>{
  const html=fs.readFileSync('demo.html','utf8'),source=fs.readFileSync('web/preview.js','utf8');assert.ok(html.includes(source));
  const p=fixture();p.run("loadScenario('week');recoveryHistory[0].Blocker='=HYPERLINK(\"bad\")'");
  assert.match(p.run('weeklyCSV()'),/"'=HYPERLINK/);assert.doesNotMatch(html,/__PREVIEW__|__ENGINE__/);
});
