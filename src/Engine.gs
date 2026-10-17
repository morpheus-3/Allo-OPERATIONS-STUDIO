/* Pure rules shared by Apps Script and the automated tests. All dates use the
   configured project timezone (Asia/Kolkata). Intervals are calendar days. */
function dayKey(d) {
  return Utilities.formatDate(new Date(d), 'Asia/Kolkata', 'yyyy-MM-dd');
}
function dateAt(day, hour) { return new Date(day + 'T' + String(hour).padStart(2, '0') + ':00:00+05:30'); }
function addDays(day, days) {
  return dayKey(new Date(dateAt(day, 12).getTime() + days * 86400000));
}
function calendarFor(cfg) {
  cfg=cfg||{};
  const raw=String(cfg.WorkingDays===undefined?'1,2,3,4,5':cfg.WorkingDays).trim();
  if(raw.split(',').some(v=>! /^[0-6]$/.test(v.trim())))throw Error('WorkingDays must contain weekday numbers 0-6 without empty entries.');
  const days=raw.split(',').map(v=>Number(v.trim()));
  if(!raw || days.some(n=>!Number.isInteger(n)||n<0||n>6) || new Set(days).size!==days.length)throw Error('WorkingDays must contain unique weekday numbers 0-6 (Sunday=0).');
  const holidays=String(cfg.HolidayDates||'').split(',').map(v=>v.trim()).filter(Boolean);
  holidays.forEach(d=>{if(!validDay(d))throw Error('HolidayDates must contain real YYYY-MM-DD dates.');});
  return {days,holidays};
}
function validDay(day) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(day)) && Number.isFinite(dateAt(day,12).getTime()) && dayKey(dateAt(day,12))===day;
}
function workingDay(day,calendar) {
  calendar=calendar||calendarFor();
  return calendar.days.includes(new Date(dateAt(day,12).getTime()+19800000).getUTCDay())&&!calendar.holidays.includes(day);
}
function firstDay(day, daily,calendar) {
  let attempts=0;
  while (daily && !workingDay(day,calendar)) {if(++attempts>3660)throw Error('No working day found within ten years.');day=addDays(day,1);}
  return day;
}
function nextSchedule(task,completedAt,previousDue,calendar) {
  const working=(task.CalendarPolicy||(task.ProofType==='DAILY'?'WORKING':'CALENDAR'))==='WORKING';
  const fixed=(task.RecurrenceMode||'COMPLETION')==='FIXED';
  let day=addDays(dayKey(fixed&&previousDue?previousDue:completedAt),Number(task.IntervalDays));const skipped=new Set();
  let due=dateAt(firstDay(day,working,calendar),Number(task.DueHour));
  // Fixed schedules retain their raw calendar anchor even when a due date moves for a holiday.
  if(fixed) {
    const anchor=task.StartDate instanceof Date?dayKey(task.StartDate):String(task.StartDate||dayKey(previousDue||completedAt));
    const interval=Number(task.IntervalDays);
    let n=Math.max(1,Math.floor((dateAt(dayKey(previousDue||completedAt),12)-dateAt(anchor,12))/86400000/interval)+1);
    while(true) {
      if(n>100000)throw Error('Fixed recurrence exceeds supported horizon.');
      day=addDays(anchor,n*interval);due=dateAt(firstDay(day,working,calendar),Number(task.DueHour));
      if(due>new Date(completedAt))break;
      if(!previousDue||due>new Date(previousDue))skipped.add(dayKey(due));n++;
    }
  }
  return {due,skipped:skipped.size};
}
function nextDue(task, completedAt,previousDue,calendar) {
  return nextSchedule(task,completedAt,previousDue,calendar).due;
}
function cycleFor(task, due) {
  return { CycleID: task.TaskID + ':' + dayKey(due), TaskID: task.TaskID,
    Task: task.Task, Employee: task.Employee, EmployeeEmail: String(task.EmployeeEmail).trim().toLowerCase(),
    DueAt: due, ProofType: task.ProofType, Proof: '', Complete: false,
    CompletedBy: '', CompletedAt: '', Status: 'Upcoming',
    ManagerAlertAt: '', Acknowledge: false, AcknowledgedBy: '', AcknowledgedAt: '',
    ManagerNote: '', LeadershipAlertAt: '', Error: '',
    Blocker:'',RecoveryOwner:'',RecoveryTargetAt:'',NextAction:'',ResolutionNote:'',SaveRecovery:false,
    ReviewOwnerEmail:'',RecoveryRevision:0,RecurrenceMode:task.RecurrenceMode||'COMPLETION',
    CalendarPolicy:task.CalendarPolicy||(task.ProofType==='DAILY'?'WORKING':'CALENDAR'),SkippedOccurrences:0 };
}
function statusFor(c, now) {
  if (c.CompletedAt) return 'Completed';
  if (new Date(c.DueAt) <= now) return 'Overdue';
  return dayKey(c.DueAt) <= dayKey(now) ? 'Due today' : 'Upcoming';
}
function alertFor(c, now, ackHours, resolveHours) {
  if (!c.ManagerAlertAt) return !c.CompletedAt && now >= new Date(c.DueAt) ? 'MANAGER' : '';
  if (c.LeadershipAlertAt) return '';
  const hours = (now - new Date(c.ManagerAlertAt)) / 3600000;
  if ((!c.AcknowledgedAt && hours >= ackHours) || (!c.CompletedAt && hours >= resolveHours)) return 'LEADERSHIP';
  return '';
}
function completionError(c) {
  if (c.ProofType === 'TICKET' && !String(c.Proof).trim()) return 'Enter a Ticket ID before checking Complete.';
  if (String(c.Proof).length > 2000) return 'Keep completion proof under 2,000 characters.';
  return '';
}
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()); }
function isSampleEmail(value) { return /@example\.(com|org|net)$/i.test(String(value || '').trim()); }
function validateTask(task) {
  if(task.RecurrenceMode && !['COMPLETION','FIXED'].includes(task.RecurrenceMode))throw Error('RecurrenceMode must be COMPLETION or FIXED.');
  if(task.CalendarPolicy && !['CALENDAR','WORKING'].includes(task.CalendarPolicy))throw Error('CalendarPolicy must be CALENDAR or WORKING.');
  if (!/^[A-Za-z0-9_-]{1,60}$/.test(String(task.TaskID))) throw new Error('TaskID must be a stable, unique ID using letters, numbers, _ or -: '+task.TaskID);
  if (!String(task.Task || '').trim() || !String(task.Employee || '').trim() || !validEmail(task.EmployeeEmail)) throw new Error('Task name, employee and valid employee email required: '+task.TaskID);
  if (![1,7,15,30].includes(Number(task.IntervalDays)) || !['DAILY','TICKET'].includes(task.ProofType)) throw new Error('Invalid recurrence or proof type: '+task.TaskID);
  if (task.ProofType === 'DAILY' && Number(task.IntervalDays) !== 1) throw new Error('DAILY tasks require IntervalDays = 1: '+task.TaskID);
  if (task.DueHour === '' || !Number.isInteger(Number(task.DueHour)) || Number(task.DueHour)<0 || Number(task.DueHour)>23) throw new Error('DueHour must be an integer 0–23: '+task.TaskID);
  const day=task.StartDate instanceof Date ? dayKey(task.StartDate) : String(task.StartDate);
  const parsed=dateAt(day,12);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(parsed.getTime()) || dayKey(parsed)!==day) throw new Error('StartDate must be a real YYYY-MM-DD date: '+task.TaskID);
}
function validateSettings(cfg) {
  calendarFor(cfg);
  const backup=String(cfg.BackupManagerEmail||'').trim();
  const start=String(cfg.ManagerLeaveStart||'').trim(),end=String(cfg.ManagerLeaveEnd||'').trim();
  if(backup && (!validEmail(backup)||backup.toLowerCase()===String(cfg.ManagerEmail).toLowerCase()))throw Error('BackupManagerEmail must be a different valid account.');
  if(start||end) {
    if(!backup||!validDay(start)||!validDay(end)||end<start)throw Error('Leave coverage requires a backup and valid inclusive start/end dates.');
  }
  if (!['true','false'].includes(String(cfg.DryRun).toLowerCase())) throw new Error('DryRun must be TRUE or FALSE; invalid values never enable sending.');
  if (!Number.isFinite(Number(cfg.AckHours)) || !Number.isFinite(Number(cfg.ResolveHours)) || !(Number(cfg.AckHours)>0) || !(Number(cfg.ResolveHours)>=Number(cfg.AckHours))) throw new Error('SLA must use finite positive hours; ResolveHours must be at least AckHours.');
  if (!validEmail(cfg.ManagerEmail) || !validEmail(cfg.LeadershipEmail)) throw new Error('Valid manager and leadership email addresses required.');
  if (String(cfg.DryRun).toLowerCase()==='false' && [cfg.ManagerEmail,cfg.LeadershipEmail,backup].filter(Boolean).some(isSampleEmail)) throw new Error('Replace sample recipients before enabling live email.');
}
function activeManager(cfg,now) {
  const day=dayKey(now);
  return String(cfg.BackupManagerEmail&&cfg.ManagerLeaveStart&&cfg.ManagerLeaveEnd&&day>=cfg.ManagerLeaveStart&&day<=cfg.ManagerLeaveEnd?cfg.BackupManagerEmail:cfg.ManagerEmail).trim().toLowerCase();
}
function reviewerEmails(c,cfg,now) {
  return [...new Set([String(cfg.ManagerEmail).trim().toLowerCase(),activeManager(cfg,now),String(c.ReviewOwnerEmail||'').trim().toLowerCase()].filter(Boolean))];
}
function recoveryError(c) {
  if(!String(c.Blocker||'').trim()||!String(c.RecoveryOwner||'').trim()||!String(c.NextAction||'').trim())return 'Enter blocker, recovery owner and next action.';
  if(!c.RecoveryTargetAt||!Number.isFinite(new Date(c.RecoveryTargetAt).getTime()))return 'Enter a valid recovery target date and time.';
  if(c.ResolutionNote&&!c.CompletedAt)return 'Employee completion is required before recording a resolution note.';
  if(['Blocker','RecoveryOwner','NextAction','ResolutionNote'].some(k=>String(c[k]||'').length>2000))return 'Keep recovery fields under 2,000 characters.';
  return '';
}
function weeklySummary(cycles,history,now,ackHours,weekStart) {
  const today=dayKey(now),weekday=new Date(dateAt(today,12).getTime()+19800000).getUTCDay();
  const start=weekStart||addDays(today,-((weekday+6)%7)),end=addDays(start,7),asOf=new Date(now);
  const from=dateAt(start,0),until=new Date(Math.min(+dateAt(end,0),+asOf));
  // A live snapshot includes events at now; a completed week excludes next Monday.
  const beforeCutoff=value=>+new Date(value)<+until||(+until<+dateAt(end,0)&&+new Date(value)===+until);
  if(until<=from)return {start,end,asOf:until,dueCount:0,onTimeCount:0,onTimeRate:null,reviewCount:0,compliantReviewCount:0,reviewRate:null,carryover:0,overdue:0,ageBuckets:[0,0,0],skippedOccurrences:0,blockers:[]};
  const due=cycles.filter(c=>new Date(c.DueAt)>=from&&beforeCutoff(c.DueAt));
  const ontime=due.filter(c=>c.CompletedAt&&new Date(c.CompletedAt)<=new Date(c.DueAt)).length;
  const reviews=cycles.filter(c=>c.ManagerAlertAt&&(+new Date(c.ManagerAlertAt)+Number(ackHours)*3600000)>=+from&&beforeCutoff(+new Date(c.ManagerAlertAt)+Number(ackHours)*3600000));
  const compliant=reviews.filter(c=>c.AcknowledgedAt&&(+new Date(c.AcknowledgedAt)-new Date(c.ManagerAlertAt))<=Number(ackHours)*3600000).length;
  const openAt=c=>beforeCutoff(c.DueAt)&&(!c.CompletedAt||!beforeCutoff(c.CompletedAt));
  const carryover=cycles.filter(c=>new Date(c.DueAt)<from&&openAt(c));
  const overdue=cycles.filter(openAt).map(c=>({cycle:c,ageHours:(until-new Date(c.DueAt))/3600000}));
  const latest=new Map();
  (history||[]).filter(h=>beforeCutoff(h.UpdatedAt)).sort((a,b)=>new Date(a.UpdatedAt)-new Date(b.UpdatedAt)).forEach(h=>latest.set(h.CycleID,h));
  const blockers={};
  overdue.forEach(({cycle:c})=>{const h=latest.get(c.CycleID);const label=String(h?h.Blocker:'Unclassified').trim()||'Unclassified';(blockers[label]||(blockers[label]={count:0,actions:new Set()})).count++;if(h&&h.NextAction)blockers[label].actions.add(String(h.NextAction));});
  return {start,end,asOf:until,dueCount:due.length,onTimeCount:ontime,onTimeRate:due.length?ontime/due.length:null,
    reviewCount:reviews.length,compliantReviewCount:compliant,reviewRate:reviews.length?compliant/reviews.length:null,
    carryover:carryover.length,overdue:overdue.length,ageBuckets:[overdue.filter(x=>x.ageHours<24).length,overdue.filter(x=>x.ageHours>=24&&x.ageHours<72).length,overdue.filter(x=>x.ageHours>=72).length],
    skippedOccurrences:due.reduce((sum,c)=>sum+Number(c.SkippedOccurrences||0),0),
    blockers:Object.entries(blockers).map(([label,v])=>({label,count:v.count,actions:[...v.actions]})).sort((a,b)=>b.count-a.count)};
}
