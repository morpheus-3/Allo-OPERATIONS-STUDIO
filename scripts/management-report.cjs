const fs=require('node:fs'),assert=require('node:assert/strict');
const {googleAdapter}=require('../tests/google-adapter.cjs');
const g=googleAdapter();g.ctx.setup();g.configure();
function set(Key,Value){g.ctx.save('Settings',{...g.ctx.records('Settings').find(r=>r.Key===Key),Key,Value});}
set('BackupManagerEmail','backup@allo.test');set('ManagerLeaveStart','2026-10-08');set('ManagerLeaveEnd','2026-10-08');
g.setTime('2026-10-08T17:00:00+05:30');g.ctx.runAutomation();
assert.equal(g.ctx.records('EmailLog')[0].Recipient,'backup@allo.test');
g.userEdit(3,17,'Agreed retry with employee','backup@allo.test');g.userEdit(3,14,true,'backup@allo.test');
for(const [col,value] of [[20,'Portal outage'],[21,'Employee B'],[22,new Date('2026-10-09T11:00:00+05:30')],[23,'Retry portal']])g.userEdit(3,col,value,'backup@allo.test');
g.userEdit(3,25,true,'backup@allo.test');g.userEdit(3,23,'Use approved alternate route','backup@allo.test');g.userEdit(3,25,true,'backup@allo.test');g.userEdit(3,25,true,'backup@allo.test');
assert.equal(g.ctx.records('RecoveryLog').length,2);
const c=g.ctx.records('Workboard').find(r=>r._row===3);assert.equal(c.CompletedAt,'');
const fixed=g.ctx.nextSchedule({IntervalDays:7,DueHour:17,ProofType:'TICKET',StartDate:'2026-10-01',RecurrenceMode:'FIXED'},g.ctx.dateAt('2026-10-23',18),g.ctx.dateAt('2026-10-08',17));
const holiday=g.ctx.nextDue({IntervalDays:1,DueHour:17,ProofType:'DAILY'},g.ctx.dateAt('2026-10-09',16),null,g.ctx.calendarFor({HolidayDates:'2026-10-12'}));
g.setTime('2026-10-08T18:00:00+05:30');
const result={release:JSON.parse(fs.readFileSync('package.json','utf8')).version,execution:'Local Google-service adapter; no live accounts or received mail',recoveryHistory:g.ctx.records('RecoveryLog'),employeeCompletionUnchanged:c.CompletedAt,alertRecipient:g.ctx.records('EmailLog')[0].Recipient,primaryAfterLeave:g.ctx.activeManager(g.ctx.settings(),g.ctx.dateAt('2026-10-09',9)),holidayNextDue:holiday,fixedNextDue:fixed,weekly:g.ctx.refreshWeeklyReport(),sentRealEmails:false};
fs.writeFileSync('evidence/UPGRADE_RESULTS.json',JSON.stringify(result,null,2)+'\n');
console.log('Recovery revisions, backup routing, holiday rollover, fixed anchor and weekly report observed with local adapters.');
