const {test}=require('node:test'),assert=require('node:assert/strict');
const {googleAdapter}=require('./google-adapter.cjs');
function fixture(){const g=googleAdapter();g.ctx.setup();g.configure();return g;}
test('Sheets API adapter: setup is repeatable and builds all sheet/protection structures',()=>{
  const g=fixture();g.ctx.setup();assert.equal(g.ctx.records('Tasks').length,4);assert.equal(g.ctx.records('Workboard').length,4);
  assert.equal(g.ss.getSpreadsheetTimeZone(),'Asia/Kolkata');assert.equal(g.ss.locale,'en_IN');
  const s=g.ss.getSheetByName('Workboard');assert.equal(s.getProtections('RANGE').length,12);assert.equal(s.getProtections('SHEET').length,1);
  assert.match(g.ss.getSheetByName('Manager').getRange('I3').getValues()[0][0],/P is null/);
});
test('employee completes using Sheets API adapter persistence, metadata locks and next cycle inherits protections',()=>{
  const g=fixture();g.userEdit(3,8,'PORTAL-100','employeeb@allo.test');g.userEdit(3,9,true,'employeeb@allo.test');
  const rows=g.ctx.records('Workboard'),done=rows.find(r=>r._row===3),next=rows.find(r=>r.TaskID==='TASK-2'&&!r.CompletedAt);
  assert.equal(done.Proof,'PORTAL-100');assert.equal(done.CompletedBy,'employeeb@allo.test');assert.equal(done.Status,'Completed');assert.equal(done.Complete,true);
  assert.equal(g.ctx.dayKey(next.DueAt),'2026-10-15');assert.equal(rows.length,5);
  assert.throws(()=>g.userEdit(3,8,'CHANGE','employeeb@allo.test'),/protection denied/);
  assert.doesNotThrow(()=>g.userEdit(next._row,8,'NEXT-TICKET','employeeb@allo.test'));
  g.userEdit(next._row,9,true,'employeeb@allo.test');assert.equal(g.ctx.records('Workboard').find(r=>r._row===next._row).Complete,false);
});
test('protected ranges deny wrong employee, system metadata, unknown rows and wrong manager',()=>{
  const g=fixture();
  for(const [row,column] of [[3,8],[2,10],[500,8],[2,14]])assert.throws(()=>g.userEdit(row,column,'bad','employeea@allo.test'),/protection denied/);
});
test('missing ticket resets checkbox without erasing typed evidence or manager note',()=>{
  const g=fixture();g.userEdit(3,9,true,'employeeb@allo.test');let c=g.ctx.records('Workboard').find(r=>r._row===3);
  assert.equal(c.Complete,false);assert.match(c.Error,/Ticket ID/);
  g.userEdit(3,8,'PORTAL-200','employeeb@allo.test');g.ctx.runAutomation();c=g.ctx.records('Workboard').find(r=>r._row===3);assert.equal(c.Proof,'PORTAL-200');
});
test('dry-run manager alert, simulated manager edit, completion and review close escalation',()=>{
  const g=fixture();g.setTime('2026-10-08T17:01:00+05:30');g.ctx.runAutomation();g.ctx.runAutomation();assert.equal(g.ctx.records('EmailLog').length,4);assert.equal(g.sent.length,0);
  g.userEdit(3,17,'Contacted employee, ticket update agreed by 18:00','manager@allo.test');g.userEdit(3,14,true,'manager@allo.test');
  g.userEdit(3,8,'PORTAL-300','employeeb@allo.test');g.userEdit(3,9,true,'employeeb@allo.test');
  g.setTime('2026-10-09T18:00:00+05:30');g.ctx.runAutomation();
  const c=g.ctx.records('Workboard').find(r=>r._row===3);assert.equal(c.AcknowledgedBy,'manager@allo.test');assert.equal(c.LeadershipAlertAt,'');
  assert.throws(()=>g.userEdit(3,17,'CHANGE','manager@allo.test'),/protection denied/);
});
test('installing automation twice keeps one timer and one edit trigger; health reports mode',()=>{
  const g=fixture();g.ctx.installTriggers();g.ctx.installTriggers();assert.equal(g.triggers.length,2);assert.equal(g.triggers.find(t=>t.handler==='runAutomation').minutes,5);
  const health=g.ctx.runHealthCheck();assert.equal(health.filter(r=>r[1]==='FAIL').length,0);assert.ok(health.some(r=>r[1]==='MANUAL'));assert.ok(health.some(r=>r[1]==='DRY_RUN'));
});
test('MailApp adapter simulates sending unique stages and catches up leadership without duplicates',()=>{
  const g=fixture();g.ss.getSheetByName('Settings').getRange(6,2).setValue(false);
  g.setTime('2026-10-08T17:00:00+05:30');g.ctx.runAutomation();g.ctx.runAutomation();assert.equal(g.sent.length,4);
  g.setTime('2026-10-08T21:00:00+05:30');g.ctx.runAutomation();g.ctx.runAutomation();assert.equal(g.sent.length,8);
  assert.ok(g.ctx.records('EmailLog').every(r=>r.DeliveryStatus==='SENT'));
});
test('one failed delivery does not block other employee alerts',()=>{
  const g=fixture();g.ss.getSheetByName('Settings').getRange(6,2).setValue(false);let calls=0;
  g.ctx.MailApp.sendEmail=()=>{if(++calls===1)throw Error('Temporary send failure');};
  g.setTime('2026-10-08T17:00:00+05:30');g.ctx.runAutomation();
  assert.equal(calls,4);assert.equal(g.ctx.records('EmailLog').filter(r=>r.DeliveryStatus==='SENT').length,3);
  g.ctx.runAutomation();assert.equal(calls,4);assert.match(g.ctx.records('Workboard')[0].Error,/review/i);
});
test('proof-only edit never attributes an already queued completion to another action',()=>{
  const g=fixture();g.ss.getSheetByName('Workboard').getRange(3,9).setValue(true);
  g.userEdit(3,8,'ID','employeeb@allo.test');assert.equal(g.ctx.records('Workboard')[1].CompletedAt,'');
});
test('strict configuration rejects duplicate IDs and unsafe dry-run values before alerts',()=>{
  const g=fixture();g.ss.getSheetByName('Settings').getRange(6,2).setValue('maybe');assert.throws(()=>g.ctx.runAutomation(),/DryRun/);assert.equal(g.sent.length,0);
  g.ss.getSheetByName('Settings').getRange(6,2).setValue(true);g.ss.getSheetByName('Tasks').getRange(3,1).setValue('TASK-1');assert.throws(()=>g.ctx.runAutomation(),/Duplicate/);
});
test('empty rows with unchecked checkboxes do not become phantom tasks or cycles',()=>{
  const g=fixture();g.ss.getSheetByName('Tasks').getRange(20,9).setValue(false);
  const board=g.ss.getSheetByName('Workboard');board.getRange(30,9).setValue(false);board.getRange(30,14).setValue(false);
  assert.equal(g.ctx.records('Tasks').length,4);assert.equal(g.ctx.records('Workboard').length,4);
  g.ctx.setup();g.ctx.runAutomation();assert.equal(g.ctx.records('Workboard').length,4);
  assert.equal(g.ctx.settings().DryRun,true);
});
test('partial task rows still fail validation instead of being silently discarded',()=>{
  const g=fixture();const master=g.ss.getSheetByName('Tasks');
  master.getRange(12,2).setValue('Missing ID');master.getRange(12,9).setValue(false);
  assert.throws(()=>g.ctx.runAutomation(),/TaskID/);
});
test('new cycles use the next logical row despite far-away FALSE placeholders',()=>{
  const g=fixture(),s=g.ss.getSheetByName('Workboard');s.getRange(999,9).setValue(false);
  g.userEdit(3,8,'TICKET','employeeb@allo.test');g.userEdit(3,9,true,'employeeb@allo.test');
  const next=g.ctx.records('Workboard').find(r=>r.TaskID==='TASK-2'&&!r.CompletedAt);assert.equal(next._row,6);
});
test('compacting Workboard preserves cycle data and ledger with a protected backup',()=>{
  const g=fixture(),s=g.ss.getSheetByName('Workboard');
  const original=g.ctx.records('Workboard').map(({_row,...data})=>data);
  const raw=s.getRange(2,1,4,19).getValues();s.getRange(2,1,4,19).clearContent();s.getRange(1001,1,4,19).setValues(raw);s.maxRows=1004;
  g.ctx.compactWorkboard();
  assert.deepEqual(g.ctx.records('Workboard').map(({_row,...data})=>data),original);
  assert.equal(g.ctx.records('Workboard')[0]._row,2);assert.equal(g.ctx.records('EmailLog').length,0);
  const backup=g.ss.getSheets().find(sh=>sh.name.startsWith('Workboard_Backup_'));assert.ok(backup);assert.equal(backup.getProtections('SHEET').length,1);
  g.ctx.compactWorkboard();assert.equal(g.ss.getSheets().filter(sh=>sh.name.startsWith('Workboard_Backup_')).length,1);
});
