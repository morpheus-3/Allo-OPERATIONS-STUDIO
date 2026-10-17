const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const vm=require('node:vm');
const {googleAdapter}=require('./google-adapter.cjs');
test('Google acceptance fixture has expected boundary populations and refuses unsafe copies',()=>{
  const g=googleAdapter();g.ctx.setup();g.configure();
  g.ss.getName=()=> 'ALLO ACCEPTANCE fixture';g.ss.getSpreadsheetLocale=()=>g.ss.locale;
  vm.runInContext(fs.readFileSync('scripts/google-sheets-acceptance.gs','utf8'),g.ctx);
  // Independent local data oracle, NOT a spreadsheet formula evaluator.
  g.ctx.recordFormulaAcceptance_=(_ss,clock,expected)=>{
    const rows=g.ctx.records('Workboard'),hours=(c)=>(clock-new Date(c.ManagerAlertAt))/3600000;
    const actual=[rows.filter(c=>!c.CompletedAt&&new Date(c.DueAt)<=clock).length,
      rows.filter(c=>!c.CompletedAt&&new Date(c.DueAt)>clock&&g.ctx.dayKey(c.DueAt)===g.ctx.dayKey(clock)).length,
      rows.filter(c=>c.ManagerAlertAt&&!c.AcknowledgedAt&&hours(c)>=4).length,
      rows.filter(c=>c.ManagerAlertAt&&!c.CompletedAt&&hours(c)>=24).length,
      g.ctx.records('EmailLog').filter(r=>['SENDING','REVIEW_REQUIRED'].includes(r.DeliveryStatus)).length,
      rows.filter(c=>c.CompletedAt).length];
    assert.deepEqual(actual,Array.from(expected));return actual;
  };
  assert.deepEqual(g.ctx.runFormulaAcceptance(),[5,1,2,2,2,2]);
  assert.equal(g.sent.length,0);
  assert.deepEqual(g.ctx.runEmptyFormulaAcceptance(),[0,0,0,0,0,0]);
  g.ss.getName=()=> 'Production';
  assert.throws(()=>g.ctx.runFormulaAcceptance(),/disposable copy/);
  g.ss.getName=()=> 'ALLO ACCEPTANCE fixture';g.ctx.installTriggers();
  assert.throws(()=>g.ctx.runFormulaAcceptance(),/Remove this copy/);
  g.triggers.length=0;g.ss.getSheetByName('Settings').getRange(6,2).setValue(false);
  assert.throws(()=>g.ctx.runFormulaAcceptance(),/DryRun must be TRUE/);
});
test('reviewer-facing demo distinguishes reported live evidence from outstanding checks',()=>{
  const html=fs.readFileSync('demo.html','utf8');
  assert.doesNotMatch(html,/actual email receipts remain pending/);
  assert.match(html,/Separate-user permissions, actual formula results and the updated deployment remain pending/);
});
test('confirmed candidate identity is present and contains no template placeholders',()=>{
  const c=JSON.parse(fs.readFileSync('candidate.json','utf8'));
  assert.equal(c.confirmedByCandidate,true);
  assert.ok(c.name.trim()&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)&&new URL(c.portfolio));
  assert.doesNotMatch(JSON.stringify(c),/YOUR|example\.com|TODO/);
});
