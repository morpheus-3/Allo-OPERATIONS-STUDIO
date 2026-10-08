const fs=require('node:fs'),assert=require('node:assert/strict');
const {googleAdapter}=require('../tests/google-adapter.cjs');
function fixture(){const g=googleAdapter();g.ctx.setup();g.configure();return g;}
function row(g,n=3){return g.ctx.records('Workboard').find(c=>c._row===n);}
function complete(g,n=3){g.userEdit(n,8,'PORTAL-DEMO-100','employeeb@allo.test');g.userEdit(n,9,true,'employeeb@allo.test');}
function alert(g){g.setTime('2026-10-08T17:00:00+05:30');g.ctx.runAutomation();}
function ack(g){g.userEdit(3,17,'Contacted employee and agreed recovery deadline','manager@allo.test');g.userEdit(3,14,true,'manager@allo.test');}
const results=[];
function scenario(id,title,fn){const evidence=fn();results.push({id,title,status:'PASS',evidence});}
scenario(1,'Automatic 7/15/30-day recurrence',()=>{
  const g=fixture(),cases=[];
  for(const [n,employee,interval] of [[3,'employeeb@allo.test',7],[4,'employeec@allo.test',15],[5,'employeed@allo.test',30]]){
    g.userEdit(n,8,'TICKET-'+interval,employee);g.userEdit(n,9,true,employee);const old=row(g,n),next=g.ctx.records('Workboard').find(c=>c.TaskID===old.TaskID&&!c.CompletedAt);
    assert.equal(g.ctx.dayKey(next.DueAt),g.ctx.addDays('2026-10-08',interval));cases.push({intervalDays:interval,closedCycle:old.CycleID,nextCycle:next.CycleID,nextDue:next.DueAt});
  }return cases;
});
scenario(2,'Single-point completion records proof, editor and timestamp',()=>{
  const g=fixture();complete(g);const c=row(g);assert.equal(c.Proof,'PORTAL-DEMO-100');assert.equal(c.CompletedBy,'employeeb@allo.test');assert.ok(c.CompletedAt);return {location:'Workboard H:I',proof:c.Proof,completedBy:c.CompletedBy,completedAt:c.CompletedAt,status:c.Status};
});
scenario(3,'Daily attestation without a ticket and weekend rollover',()=>{
  const g=fixture();g.setTime('2026-10-09T16:00:00+05:30');g.userEdit(2,9,true,'employeea@allo.test');const c=row(g,2),next=g.ctx.records('Workboard').find(r=>r.TaskID===c.TaskID&&!r.CompletedAt);assert.ok(c.CompletedAt);assert.equal(g.ctx.dayKey(next.DueAt),'2026-10-12');return {proofRequired:'Checkbox attestation; evidence optional',completedAt:c.CompletedAt,nextDue:next.DueAt};
});
scenario(4,'Same-day manager alert at cutoff',()=>{
  const g=fixture();g.ctx.runAutomation();assert.equal(g.ctx.records('EmailLog').length,0);alert(g);const c=row(g),log=g.ctx.records('EmailLog').find(r=>r.CycleID===c.CycleID);assert.equal(log.Stage,'MANAGER');return {due:c.DueAt,alert:c.ManagerAlertAt,deliveryStatus:log.DeliveryStatus,actualEmailSent:false};
});
scenario(5,'Manager action acknowledged separately from completion',()=>{
  const g=fixture();alert(g);ack(g);assert.equal(row(g).CompletedAt,'');complete(g);const c=row(g);assert.ok(c.AcknowledgedAt&&c.CompletedAt);return {managerNote:c.ManagerNote,acknowledgedBy:c.AcknowledgedBy,acknowledgedAt:c.AcknowledgedAt,completedBy:c.CompletedBy,completedAt:c.CompletedAt};
});
scenario(6,'Leadership escalation when manager review is missing',()=>{
  const g=fixture();alert(g);g.setTime('2026-10-08T21:00:00+05:30');g.ctx.runAutomation();assert.ok(row(g).LeadershipAlertAt);return {managerAlert:row(g).ManagerAlertAt,leadershipAlert:row(g).LeadershipAlertAt,reason:'No manager acknowledgement within four elapsed hours'};
});
scenario(7,'SLA boundaries and resolved-work suppression',()=>{
  const g=fixture();alert(g);ack(g);g.setTime('2026-10-08T21:00:00+05:30');g.ctx.runAutomation();assert.equal(row(g).LeadershipAlertAt,'');g.setTime('2026-10-09T17:00:00+05:30');g.ctx.runAutomation();assert.ok(row(g).LeadershipAlertAt);
  const h=fixture();alert(h);ack(h);complete(h);h.setTime('2026-10-09T18:00:00+05:30');h.ctx.runAutomation();assert.equal(row(h).LeadershipAlertAt,'');return {acknowledgedButUnresolvedEscalation:row(g).LeadershipAlertAt,resolvedAndReviewedEscalation:row(h).LeadershipAlertAt||'Suppressed',reviewHours:4,resolutionHours:24};
});
scenario(8,'Repeated automation creates no duplicate alerts or cycles',()=>{
  const g=fixture();alert(g);const before={cycles:g.ctx.records('Workboard').length,alerts:g.ctx.records('EmailLog').length};for(let i=0;i<5;i++)g.ctx.runAutomation();const after={cycles:g.ctx.records('Workboard').length,alerts:g.ctx.records('EmailLog').length};assert.deepEqual(before,after);return {before,after,repeatedRuns:5};
});
fs.mkdirSync('evidence',{recursive:true});
fs.writeFileSync('evidence/DEMO_RESULTS.json',JSON.stringify({execution:'Local Sheets API adapter; simulated accounts, clock and email',realGoogleServicesVerified:false,timezone:'Asia/Kolkata',results},null,2)+'\n');
fs.writeFileSync('evidence/DEMO_RESULTS.md','# Eight assignment scenarios\n\nAll scenarios use the actual Apps Script functions with local Google-service adapters. No real emails or Google sessions were used.\n\n| Test | Scenario | Result |\n| --- | --- | --- |\n'+results.map(r=>'| '+r.id+' | '+r.title+' | '+r.status+' |').join('\n')+'\n\nDetailed inputs, timestamps and results: DEMO_RESULTS.json. Hosted acceptance is recorded separately in submission/HOSTED_ACCEPTANCE.md.\n');
console.log('All eight deterministic assignment scenarios passed. Evidence written to evidence/.');
