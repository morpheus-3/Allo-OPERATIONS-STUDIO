const {test}=require('node:test'),assert=require('node:assert/strict');
const {googleAdapter}=require('./google-adapter.cjs');
function fixture(){const g=googleAdapter();g.ctx.setup();g.configure();return g;}
function setting(g,key,value){const old=g.ctx.records('Settings').find(r=>r.Key===key);g.ctx.save('Settings',{...old,Key:key,Value:value});}
function recovery(g,n=3,actor='manager@allo.test'){
  for(const [col,value] of [[20,'Portal outage'],[21,'Employee B'],[22,new Date('2026-10-09T11:00:00+05:30')],[23,'Retry ticket submission']])g.userEdit(n,col,value,actor);
  g.userEdit(n,25,true,actor);
}
test('recovery stays editable after acknowledgement, versions changes and suppresses unchanged retries',()=>{
  const g=fixture();g.setTime('2026-10-08T17:00:00+05:30');g.ctx.runAutomation();
  g.userEdit(3,17,'Contacted owner','manager@allo.test');g.userEdit(3,14,true,'manager@allo.test');
  recovery(g);assert.equal(g.ctx.records('RecoveryLog').length,1);
  assert.equal(g.ctx.records('Workboard')[1].RecoveryRevision,1);
  g.userEdit(3,25,true,'manager@allo.test');assert.equal(g.ctx.records('RecoveryLog').length,1);
  g.userEdit(3,23,'Use approved alternate portal','manager@allo.test');g.userEdit(3,25,true,'manager@allo.test');
  const log=g.ctx.records('RecoveryLog');assert.equal(log.length,2);assert.equal(log[0].NextAction,'Retry ticket submission');assert.equal(log[1].NextAction,'Use approved alternate portal');assert.equal(log[1].UpdatedBy,'manager@allo.test');
  assert.throws(()=>g.userEdit(3,20,'tamper','employeeb@allo.test'),/protection denied/);
  assert.equal(g.ctx.records('Workboard')[1].CompletedAt,'');
});
test('resolution note requires actual employee completion and missing recovery inputs reject save',()=>{
  const g=fixture();g.userEdit(3,25,true,'manager@allo.test');assert.equal(g.ctx.records('RecoveryLog').length,0);
  recovery(g);g.userEdit(3,24,'Resolved','manager@allo.test');g.userEdit(3,25,true,'manager@allo.test');
  assert.match(g.ctx.records('Workboard')[1].Error,/Employee completion/);assert.equal(g.ctx.records('RecoveryLog').length,1);
  g.userEdit(3,8,'PORTAL-OK','employeeb@allo.test');g.userEdit(3,9,true,'employeeb@allo.test');g.userEdit(3,25,true,'manager@allo.test');
  assert.equal(g.ctx.records('RecoveryLog')[1].ResolutionNote,'Resolved');
});
test('leave coverage routes alerts to backup and new alerts return automatically to primary',()=>{
  const g=fixture();setting(g,'BackupManagerEmail','backup@allo.test');setting(g,'ManagerLeaveStart','2026-10-08');setting(g,'ManagerLeaveEnd','2026-10-08');
  g.setTime('2026-10-08T17:00:00+05:30');g.ctx.runAutomation();
  assert.ok(g.ctx.records('EmailLog').every(r=>r.Recipient==='backup@allo.test'));
  assert.equal(g.ctx.records('Workboard')[1].ReviewOwnerEmail,'backup@allo.test');
  g.userEdit(3,17,'Covering manager called owner','backup@allo.test');g.userEdit(3,14,true,'backup@allo.test');
  assert.equal(g.ctx.records('Workboard')[1].AcknowledgedBy,'backup@allo.test');
  assert.equal(g.ctx.activeManager(g.ctx.settings(),g.ctx.dateAt('2026-10-09',9)),'manager@allo.test');
  assert.equal(g.ctx.activeManager(g.ctx.settings(),g.ctx.dateAt('2026-10-07',23)),'manager@allo.test');
  g.userEdit(3,8,'PORTAL-COVER','employeeb@allo.test');g.userEdit(3,9,true,'employeeb@allo.test');
  const next=g.ctx.records('Workboard').find(c=>c.TaskID==='TASK-2'&&!c.CompletedAt);
  g.setTime('2026-10-15T17:00:00+05:30');g.ctx.runAutomation();g.ctx.runAutomation();
  const logs=g.ctx.records('EmailLog').filter(r=>r.CycleID===next.CycleID&&r.Stage==='MANAGER');
  assert.equal(logs.length,1);assert.equal(logs[0].Recipient,'manager@allo.test');
  assert.throws(()=>g.ctx.validateSettings({...g.ctx.settings(),ManagerLeaveEnd:'2026-10-07'}),/Leave coverage/);
});
test('working calendar skips configured holidays and respects a nonstandard workweek',()=>{
  const {ctx}=fixture(),task={TaskID:'CAL',IntervalDays:1,ProofType:'DAILY',DueHour:17};
  const cal=ctx.calendarFor({WorkingDays:'1,2,3,4,5',HolidayDates:'2026-10-12'});
  assert.equal(ctx.dayKey(ctx.nextDue(task,ctx.dateAt('2026-10-09',16),null,cal)),'2026-10-13');
  assert.equal(ctx.workingDay('2026-10-11',ctx.calendarFor({WorkingDays:'0,1,2,3,4'})),true);
  for(const cfg of [{WorkingDays:''},{WorkingDays:'1,1'},{WorkingDays:'1,,2'},{WorkingDays:'8'},{HolidayDates:'2026-02-30'}])assert.throws(()=>ctx.calendarFor(cfg));
});
test('fixed recurrence retains anchor, skips elapsed schedule dates and deduplicates rolled dates',()=>{
  const {ctx}=fixture(),t={TaskID:'FIX',IntervalDays:7,ProofType:'TICKET',DueHour:17,StartDate:'2026-10-01',RecurrenceMode:'FIXED',CalendarPolicy:'CALENDAR'};
  const result=ctx.nextSchedule(t,ctx.dateAt('2026-10-23',18),ctx.dateAt('2026-10-08',17));
  assert.equal(ctx.dayKey(result.due),'2026-10-29');assert.equal(result.skipped,2);
  const daily={...t,IntervalDays:1,ProofType:'DAILY',StartDate:'2026-10-09',CalendarPolicy:'WORKING'};
  const d=ctx.nextSchedule(daily,ctx.dateAt('2026-10-12',18),ctx.dateAt('2026-10-09',17));
  assert.equal(ctx.dayKey(d.due),'2026-10-13');assert.equal(d.skipped,1);
  const weekly={...t,CalendarPolicy:'WORKING',StartDate:'2026-10-02'};
  const cal=ctx.calendarFor({HolidayDates:'2026-10-09'});
  assert.equal(ctx.dayKey(ctx.nextDue(weekly,ctx.dateAt('2026-10-12',16),ctx.dateAt('2026-10-12',17),cal)),'2026-10-16');
});
test('weekly denominators include unresolved due cycles and mature review deadlines, with historical carryover',()=>{
  const {ctx}=fixture(),at=(day,h=17)=>ctx.dateAt(day,h);
  const rows=[
    {CycleID:'old',DueAt:at('2026-10-02'),CompletedAt:'',ManagerAlertAt:at('2026-10-02'),AcknowledgedAt:''},
    {CycleID:'ontime',DueAt:at('2026-10-06'),CompletedAt:at('2026-10-06',16),ManagerAlertAt:''},
    {CycleID:'late',DueAt:at('2026-10-07'),CompletedAt:at('2026-10-08',9),ManagerAlertAt:at('2026-10-07'),AcknowledgedAt:at('2026-10-07',18)},
    {CycleID:'open',DueAt:at('2026-10-08'),CompletedAt:'',ManagerAlertAt:at('2026-10-08'),AcknowledgedAt:''},
    {CycleID:'future',DueAt:at('2026-10-09'),CompletedAt:'',ManagerAlertAt:''}
  ];
  const history=[{CycleID:'old',UpdatedAt:at('2026-10-03'),Blocker:'Supplier',NextAction:'Call supplier'},
    {CycleID:'open',UpdatedAt:at('2026-10-08',18),Blocker:'Supplier',NextAction:'Escalate dependency'}];
  const s=ctx.weeklySummary(rows,history,at('2026-10-08',22),4);
  assert.equal(s.dueCount,3);assert.equal(s.onTimeCount,1);assert.equal(s.reviewCount,2);assert.equal(s.compliantReviewCount,1);
  assert.equal(s.carryover,1);assert.equal(s.overdue,2);assert.equal(s.blockers[0].count,2);
  const prior=ctx.weeklySummary(rows,history,at('2026-10-08',22),4,'2026-09-28');
  assert.equal(prior.overdue,1);assert.equal(prior.asOf.getTime(),at('2026-10-05',0).getTime());
  const empty=ctx.weeklySummary([],[],at('2026-10-08'),4);assert.equal(empty.onTimeRate,null);assert.equal(empty.reviewRate,null);
  const future=ctx.weeklySummary(rows,history,at('2026-10-08'),4,'2026-10-12');assert.equal(future.overdue,0);assert.equal(future.onTimeRate,null);
});
test('setup upgrades old header suffixes without changing history and refuses unknown columns',()=>{
  const g=fixture(),board=g.ss.getSheetByName('Workboard'),master=g.ss.getSheetByName('Tasks');
  board.getRange(1,20,1,11).clearContent();master.getRange(1,10,1,2).clearContent();
  g.ctx.setup();assert.equal(board.getRange(1,30).getValues()[0][0],'SkippedOccurrences');assert.equal(g.ctx.records('Workboard').length,4);
  master.getRange(1,10).setValue('Unknown field');assert.throws(()=>g.ctx.setup(),/Unknown columns/);
});

test('weekly live cutoff includes due, review and recovery events exactly at now',()=>{
  const {ctx}=fixture(),now=ctx.dateAt('2026-10-08',21);
  const rows=[{CycleID:'due',DueAt:now},{CycleID:'review',DueAt:ctx.dateAt('2026-10-08',17),ManagerAlertAt:ctx.dateAt('2026-10-08',17),AcknowledgedAt:now,CompletedAt:now}];
  const s=ctx.weeklySummary(rows,[{CycleID:'due',UpdatedAt:now,Blocker:'Dependency',NextAction:'Call owner'}],now,4);
  assert.equal(s.dueCount,2);assert.equal(s.overdue,1);assert.equal(s.reviewCount,1);assert.equal(s.compliantReviewCount,1);assert.equal(s.blockers[0].label,'Dependency');
  const monday=ctx.dateAt('2026-10-12',0);
  const prior=ctx.weeklySummary([{CycleID:'next',DueAt:monday}],[],monday,4,'2026-10-05');
  assert.equal(prior.dueCount,0);assert.equal(prior.overdue,0);
});
