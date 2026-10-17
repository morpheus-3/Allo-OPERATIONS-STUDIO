const {test}=require('node:test'),assert=require('node:assert/strict');
const {googleAdapter}=require('./google-adapter.cjs');
function fixture(){const g=googleAdapter();g.ctx.setup();g.configure();let actor='employeea@allo.test';g.ctx.Session.getActiveUser=()=>({getEmail:()=>actor});const submit=g.ctx.submitLeaveRequest,decide=g.ctx.decideLeaveRequest;g.rawSubmit=submit;g.rawDecide=decide;g.ctx.submitLeaveRequest=input=>{submit(input);g.ctx.processLeaveQueue_();return g.ctx.getLeaveOverview(input.StartDate.slice(0,4));};g.ctx.decideLeaveRequest=(id,action,note)=>{const view=decide(id,action,note);g.ctx.processLeaveQueue_();return g.ctx.getLeaveOverview(view.year);};return {...g,actor:email=>actor=email};}
function request(g,id,start,end){return g.ctx.submitLeaveRequest({RequestID:'LR-'+id.padEnd(10,'0'),StartDate:start,EndDate:end});}
test('leave counts configured working days, excludes holidays, and rejects year-spanning and empty requests',()=>{
  const g=fixture();assert.equal(g.ctx.leaveDays('2026-10-09','2026-10-13',{HolidayDates:'2026-10-12'}),2);
  assert.throws(()=>g.ctx.leaveDays('2026-12-31','2027-01-01',{}),/Split/);assert.throws(()=>g.ctx.leaveDays('2026-10-10','2026-10-11',{}),/no configured/);
  assert.throws(()=>g.ctx.leaveEntitlement({AnnualPaidLeaveDays:-1}),/integer/);
});
test('leave requests are own-account only, overlap checked and retries idempotent',()=>{
  const g=fixture();const a=request(g,'first','2026-10-12','2026-10-13');assert.equal(a.balances[0].remaining,50);assert.equal(a.balances[0].pending,2);
  request(g,'first','2026-10-12','2026-10-13');assert.equal(g.ctx.records('LeaveRequests').length,1);
  assert.throws(()=>request(g,'overlap','2026-10-13','2026-10-14'),/overlap/);assert.throws(()=>request(g,'past','2026-10-01','2026-10-02'),/past/);
  g.actor('stranger@allo.test');assert.throws(()=>g.ctx.getLeaveOverview(2026),/authorized/);assert.throws(()=>request(g,'intruder','2026-10-15','2026-10-15'),/assigned employee/);
});
test('manager approval reserves annual balance once, history retained, cancellation restores it',()=>{
  const g=fixture();request(g,'approval','2026-10-12','2026-10-13');const id=g.ctx.records('LeaveRequests')[0].RequestID;
  assert.throws(()=>g.ctx.decideLeaveRequest(id,'APPROVED',''),/Only the primary/);
  g.actor('manager@allo.test');g.ctx.decideLeaveRequest(id,'APPROVED','');g.ctx.decideLeaveRequest(id,'APPROVED','');
  assert.equal(g.ctx.records('LeaveLog').filter(r=>['APPROVED','REJECTED','CANCELLED'].includes(r.Action)).length,1);g.actor('employeea@allo.test');assert.equal(g.ctx.getLeaveOverview(2026).balances[0].remaining,48);
  assert.throws(()=>g.ctx.decideLeaveRequest(id,'CANCELLED','withdraw'),/Only managers/);
  g.actor('manager@allo.test');g.ctx.decideLeaveRequest(id,'CANCELLED','Plans changed');assert.equal(g.ctx.records('LeaveLog').filter(r=>['APPROVED','REJECTED','CANCELLED'].includes(r.Action)).length,2);
  g.actor('employeea@allo.test');assert.equal(g.ctx.getLeaveOverview(2026).balances[0].remaining,50);
});
test('approval rechecks remaining balance and rejects self-approval; pending does not reserve',()=>{
  const g=fixture();request(g,'long','2026-10-12','2026-12-18');request(g,'short','2026-12-21','2026-12-31');
  const rows=g.ctx.records('LeaveRequests');g.actor('manager@allo.test');g.ctx.decideLeaveRequest(rows[0].RequestID,'APPROVED','');assert.throws(()=>g.ctx.decideLeaveRequest(rows[1].RequestID,'APPROVED',''),/Insufficient/);
  const self={...rows[1],EmployeeEmail:'manager@allo.test'};assert.throws(()=>g.ctx.leaveDecision([self],self.RequestID,'APPROVED','manager@allo.test',g.ctx.settings(),new Date('2026-10-08'),''),/Self/);
});
test('leave decision ledger protects balance after an interrupted request-row write',()=>{
  const g=fixture();request(g,'reconcile','2026-10-12','2026-10-13');const id=g.ctx.records('LeaveRequests')[0].RequestID;
  g.actor('manager@allo.test');const real=g.ctx.save;g.ctx.save=(name,obj)=>{if(name==='LeaveRequests')throw Error('write interrupted');return real(name,obj);};
  g.ctx.decideLeaveRequest(id,'APPROVED','');g.ctx.save=real;
  g.actor('employeea@allo.test');assert.equal(g.ctx.getLeaveOverview(2026).balances[0].remaining,48);
  g.actor('manager@allo.test');g.ctx.decideLeaveRequest(id,'APPROVED','');assert.equal(g.ctx.records('LeaveLog').filter(r=>['APPROVED','REJECTED','CANCELLED'].includes(r.Action)).length,1);assert.equal(g.ctx.records('LeaveRequests')[0].Status,'APPROVED');
});
test('employees see their own records and a shared email has one entitlement',()=>{
  const g=fixture();request(g,'private','2026-10-12','2026-10-13');g.actor('employeeb@allo.test');assert.equal(g.ctx.getLeaveOverview(2026).requests.length,0);
  const master=g.ss.getSheetByName('Tasks');for(let row=2;row<=5;row++)master.getRange(row,4).setValue('shared@allo.test');
  g.actor('manager@allo.test');assert.equal(g.ctx.getLeaveOverview(2026).balances.length,1);assert.equal(g.ctx.getLeaveOverview(2026).balances[0].entitlement,50);
});

test('leave backup approval expires with the cover window and past approved leave cannot be cancelled',()=>{
  const g=fixture();request(g,'cover','2026-10-12','2026-10-13');const id=g.ctx.records('LeaveRequests')[0].RequestID;
  for(const [key,value] of Object.entries({BackupManagerEmail:'cover@allo.test',ManagerLeaveStart:'2026-10-08',ManagerLeaveEnd:'2026-10-08'})){const row=g.ctx.records('Settings').find(x=>x.Key===key);g.ss.getSheetByName('Settings').getRange(row._row,2).setValue(value);}
  g.actor('cover@allo.test');g.ctx.decideLeaveRequest(id,'APPROVED','');g.setTime('2026-10-09T16:00:00+05:30');assert.throws(()=>g.ctx.getLeaveOverview(2026),/authorized/);
  g.actor('manager@allo.test');g.setTime('2026-10-12T16:00:00+05:30');assert.throws(()=>g.ctx.decideLeaveRequest(id,'CANCELLED','Plans changed'),/once its start/);
});

test('live leave endpoint queues signed commands and only the owner worker writes protected records',()=>{
  const g=fixture();g.rawSubmit({RequestID:'LR-queued00001',StartDate:'2026-10-12',EndDate:'2026-10-13'});
  assert.equal(g.ctx.records('LeaveRequests').length,0);assert.equal(g.ctx.records('LeaveQueue').length,1);
  assert.match(g.ctx.getLeaveOverview(2026).notice,/1 command/);g.ctx.processLeaveQueue_();g.ctx.processLeaveQueue_();assert.equal(g.ctx.records('LeaveRequests').length,1);
  assert.equal(g.ctx.records('LeaveLog').filter(r=>r.Action==='APPLIED').length,1);
  const queue=g.ctx.records('LeaveQueue')[0];queue.Payload=queue.Payload.replace('employeea@allo.test','manager@allo.test');assert.equal(g.ctx.verifyLeaveCommand_(queue),null);
});

test('owner queue worker rechecks approval balance when competing requests were queued',()=>{
  const g=fixture();request(g,'bigqueued','2026-10-12','2026-12-18');request(g,'smallqueued','2026-12-21','2026-12-31');
  const rows=g.ctx.records('LeaveRequests');g.actor('manager@allo.test');g.rawDecide(rows[0].RequestID,'APPROVED','');g.rawDecide(rows[1].RequestID,'APPROVED','');
  g.ctx.processLeaveQueue_();assert.equal(g.ctx.leaveRead_().filter(r=>r.Status==='APPROVED').length,1);assert.equal(g.ctx.records('LeaveLog').filter(r=>r.Action==='ERROR').length,1);
});
