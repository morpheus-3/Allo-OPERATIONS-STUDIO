const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function harness() {
  const ctx=vm.createContext({Utilities:{formatDate(d){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}},console});
  vm.runInContext(fs.readFileSync('src/Engine.gs','utf8')+'\n'+fs.readFileSync('src/Code.gs','utf8'),ctx);
  const db={Tasks:[],Workboard:[],EmailLog:[],Settings:[]};
  ctx.records=n=>db[n].map(x=>({...x}));
  ctx.save=(n,o)=>{if(!o._row)o._row=db[n].length+2;db[n][o._row-2]={...o};};
  ctx.protectCycle=()=>{};ctx.formatCycle=()=>{};ctx.requireOwner=()=>{};ctx.locked=fn=>fn();ctx.PropertiesService={getScriptProperties:()=>({setProperty(){}})};
  ctx.book=()=>({getUrl:()=> 'https://example.test/sheet'});
  ctx.settings=()=>({ManagerEmail:'manager@allo.test',LeadershipEmail:'leader@allo.test',AckHours:4,ResolveHours:24,DryRun:true});
  return {ctx,db};
}
function task(n=7) {return {TaskID:'T1',Task:'Portal task',Employee:'Employee B',EmployeeEmail:'b@allo.test',IntervalDays:n,ProofType:n===1?'DAILY':'TICKET',StartDate:'2026-10-08',DueHour:17,Active:true};}
function cycle(ctx,n=7) {return ctx.cycleFor(task(n),ctx.dateAt('2026-10-08',17));}
function edit(ctx,row,actor) {ctx.handleEdit({user:actor?{getEmail:()=>actor}:undefined,range:{getSheet:()=>({getName:()=> 'Workboard',getRange:()=>({setValue(){}})}),getRow:()=>row,getLastRow:()=>row,getColumn:()=>9,getLastColumn:()=>14}});}
test('1: 7/15/30 day completion creates one next cycle, completion anchored',()=>{
 for(const n of [7,15,30]) {
  const {ctx,db}=harness();db.Tasks.push(task(n));ctx.ensureCycles(new Date());
  db.Workboard[0].CompletedAt=ctx.dateAt('2026-10-09',18);
  ctx.ensureCycles(new Date());ctx.ensureCycles(new Date());
  assert.equal(db.Workboard.length,2);
  assert.equal(ctx.dayKey(db.Workboard[1].DueAt),ctx.addDays('2026-10-09',n));
 }
});
test('2: single-point ticket completion records actual editor, timestamp, next cycle',()=>{
 const {ctx,db}=harness();db.Tasks.push({...task(),StartDate:'2020-01-01'});ctx.ensureCycles(new Date());
 Object.assign(db.Workboard[0],{Proof:'PORTAL-42',Complete:true});edit(ctx,2,'b@allo.test');
 assert.equal(db.Workboard[0].CompletedBy,'b@allo.test');assert.ok(db.Workboard[0].CompletedAt);assert.equal(db.Workboard.length,2);
 edit(ctx,2,'b@allo.test');assert.equal(db.Workboard.length,2);
});
test('3: daily attestation needs no ticket; Friday rolls to Monday',()=>{
 const {ctx,db}=harness();db.Tasks.push({...task(1),StartDate:'2020-01-01'});ctx.ensureCycles(new Date());
 db.Workboard[0].Complete=true;edit(ctx,2,'b@allo.test');assert.ok(db.Workboard[0].CompletedAt);
 assert.equal(ctx.dayKey(ctx.nextDue(task(1),ctx.dateAt('2026-10-09',18))),'2026-10-12');
});
test('4: manager alerted at same-day cutoff, not before',()=>{
 const {ctx}=harness(),c=cycle(ctx);assert.equal(ctx.alertFor(c,ctx.dateAt('2026-10-08',16),4,24),'');
 assert.equal(ctx.alertFor(c,ctx.dateAt('2026-10-08',17),4,24),'MANAGER');
});
test('5: manager acknowledgment requires manager identity and action note',()=>{
 const {ctx,db}=harness();const c=cycle(ctx);c.ManagerAlertAt=new Date();c.Acknowledge=true;c.ManagerNote='Called employee';ctx.save('Workboard',c);
 edit(ctx,2,'b@allo.test');assert.equal(db.Workboard[0].AcknowledgedAt,'');
 db.Workboard[0].Acknowledge=true;edit(ctx,2,'manager@allo.test');assert.equal(db.Workboard[0].AcknowledgedBy,'manager@allo.test');
});
test('6/7: escalate missing acknowledgment at 4h, unresolved acknowledged work at 24h',()=>{
 const {ctx}=harness(),c=cycle(ctx);c.ManagerAlertAt=ctx.dateAt('2026-10-08',17);
 assert.equal(ctx.alertFor(c,ctx.dateAt('2026-10-08',20),4,24),'');
 assert.equal(ctx.alertFor(c,ctx.dateAt('2026-10-08',21),4,24),'LEADERSHIP');
 c.AcknowledgedAt=ctx.dateAt('2026-10-08',18);
 assert.equal(ctx.alertFor(c,ctx.dateAt('2026-10-08',21),4,24),'');
 assert.equal(ctx.alertFor(c,ctx.dateAt('2026-10-09',17),4,24),'LEADERSHIP');
 c.CompletedAt=ctx.dateAt('2026-10-09',16);assert.equal(ctx.alertFor(c,ctx.dateAt('2026-10-09',17),4,24),'');
});
test('8: repeated jobs do not duplicate cycles or manager/leadership alerts',()=>{
 const {ctx,db}=harness();db.Tasks.push({...task(),StartDate:'2020-01-01'});
 ctx.runAutomation();ctx.runAutomation();assert.equal(db.Workboard.length,1);assert.equal(db.EmailLog.length,1);
 db.Workboard[0].ManagerAlertAt=ctx.dateAt('2020-01-01',17);
 ctx.runAutomation();ctx.runAutomation();assert.equal(db.EmailLog.length,2);
 assert.ok(db.Workboard[0].LeadershipAlertAt);
});
test('reject missing ticket, missing identity, wrong employee, early completion',()=>{
 for(const actor of [undefined,'someone@allo.test','b@allo.test']) {
  const {ctx,db}=harness();ctx.save('Workboard',cycle(ctx));db.Workboard[0].Complete=true;edit(ctx,2,actor);
  assert.equal(db.Workboard[0].CompletedAt,'');assert.ok(db.Workboard[0].Error);
 }
 const {ctx,db}=harness();const c=ctx.cycleFor(task(),ctx.dateAt('2099-01-01',17));c.Complete=true;c.Proof='ID';ctx.save('Workboard',c);edit(ctx,2,'b@allo.test');assert.equal(db.Workboard[0].CompletedAt,'');
});
test('completed task still escalates if required manager review is missing',()=>{
 const {ctx}=harness(),c=cycle(ctx);c.ManagerAlertAt=ctx.dateAt('2026-10-08',17);c.CompletedAt=ctx.dateAt('2026-10-08',18);
 assert.equal(ctx.alertFor(c,ctx.dateAt('2026-10-08',21),4,24),'LEADERSHIP');
});
test('send failure is held for review and not retried automatically',()=>{
 const {ctx,db}=harness();let calls=0;ctx.MailApp={sendEmail(){calls++;throw Error('simulated outage');}};
 const cfg={...ctx.settings(),DryRun:false};const c=cycle(ctx);
 assert.throws(()=>ctx.deliver(c,'MANAGER',cfg,new Date()),/outage/);
 ctx.deliver(c,'MANAGER',cfg,new Date());assert.equal(calls,1);assert.equal(db.EmailLog[0].DeliveryStatus,'REVIEW_REQUIRED');
});
test('successful live delivery logs once and refuses placeholder recipients',()=>{
 const {ctx,db}=harness();let calls=0;ctx.MailApp={sendEmail(){calls++;}};const c=cycle(ctx),cfg={...ctx.settings(),DryRun:false};
 ctx.deliver(c,'MANAGER',cfg,new Date());ctx.deliver(c,'MANAGER',cfg,new Date());assert.equal(calls,1);assert.equal(db.EmailLog[0].DeliveryStatus,'SENT');
 assert.throws(()=>ctx.deliver(c,'LEADERSHIP',{...cfg,LeadershipEmail:'leader@example.com'},new Date()),/sample/);
});

