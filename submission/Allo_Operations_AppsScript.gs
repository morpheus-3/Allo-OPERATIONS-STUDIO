// Allo Operations Manager v2.1.0
// Paste this bundle OR the separate source files, never both.

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


const HEADERS = {
  Tasks: ['TaskID','Task','Employee','EmployeeEmail','IntervalDays','ProofType','StartDate','DueHour','Active','RecurrenceMode','CalendarPolicy'],
  Workboard: ['CycleID','TaskID','Task','Employee','EmployeeEmail','DueAt','ProofType','Proof','Complete','CompletedBy','CompletedAt','Status','ManagerAlertAt','Acknowledge','AcknowledgedBy','AcknowledgedAt','ManagerNote','LeadershipAlertAt','Error','Blocker','RecoveryOwner','RecoveryTargetAt','NextAction','ResolutionNote','SaveRecovery','ReviewOwnerEmail','RecoveryRevision','RecurrenceMode','CalendarPolicy','SkippedOccurrences'],
  Settings: ['Key','Value'],
  EmailLog: ['Key','CycleID','Stage','Recipient','CreatedAt','SentAt','DeliveryStatus','Error'],
  RecoveryLog: ['EntryID','CycleID','Revision','UpdatedAt','UpdatedBy','Blocker','RecoveryOwner','RecoveryTargetAt','NextAction','ResolutionNote','ChangeSummary'],
  LeaveRequests: ['RequestID','EmployeeEmail','StartDate','EndDate','Days','Year','Status','RequestedAt','DecidedBy','DecidedAt','DecisionNote'],
  LeaveLog: ['EntryID','RequestID','Action','Actor','At','Note'],
  LeaveQueue: ['QueueID','Payload','Signature']
};
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Allo Operations')
    .addItem('Ask Gaurang', 'openGaurang').addItem('Paid leave requests and balances', 'openLeave')
    .addItem('Set up prototype', 'setup').addItem('Run automation now', 'runAutomation')
    .addItem('Install automation triggers', 'installTriggers')
    .addItem('Run health check', 'runHealthCheck')
    .addItem('Refresh weekly management report', 'refreshWeeklyReport')
    .addItem('Move Workboard data to the top', 'compactWorkboard').addToUi();
}
function book() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}
function records(name) {
  const s = book().getSheetByName(name);
  if (!s) throw new Error('Missing sheet '+name+'. Run setup first.');
  const actual=s.getRange(1,1,1,HEADERS[name].length).getValues()[0];
  if (!HEADERS[name].every((h,i)=>actual[i]===h)) throw new Error('Unexpected columns in '+name+'. Restore the supplied header order.');
  if (s.getLastRow() < 2) return [];
  return s.getRange(2,1,s.getLastRow()-1,HEADERS[name].length).getValues().map((row,i) => {
    const obj = {_row:i+2}; HEADERS[name].forEach((h,j) => obj[h]=row[j]); return obj;
  // Unchecked checkboxes can leave FALSE in otherwise empty spreadsheet rows.
  // Keep real partial records for validation, but ignore checkbox-only blanks.
  }).filter(obj=>HEADERS[name].some(h=>obj[h]!==false && String(obj[h] ?? '').trim()!==''));
}
function save(name, obj) {
  const s = book().getSheetByName(name);
  const row = HEADERS[name].map(h => obj[h] === undefined ? '' : obj[h]);
  if (obj._row && name==='Workboard') {
    // Refresh generated fields without overwriting concurrent human input.
    [[10,4],[15,2],[18,2],[26,5]].forEach(([start,length])=>s.getRange(obj._row,start,1,length).setValues([row.slice(start-1,start-1+length)]));
  } else if (obj._row) s.getRange(obj._row,1,1,row.length).setValues([row]);
  else {
    // Physical lastRow can include thousands of FALSE checkbox placeholders.
    obj._row=records(name).reduce((last,r)=>Math.max(last,r._row),1)+1;
    if(obj._row>s.getMaxRows())s.insertRowsAfter(s.getMaxRows(),obj._row-s.getMaxRows());
    s.getRange(obj._row,1,1,row.length).setValues([row]);
  }
  SpreadsheetApp.flush();
}
function settings() {
  const cfg=Object.fromEntries(records('Settings').map(r=>[r.Key,r.Value]));
  ['ManagerEmail','LeadershipEmail','BackupManagerEmail'].forEach(k=>{if(cfg[k])cfg[k]=String(cfg[k]).trim().toLowerCase();});
  ['ManagerLeaveStart','ManagerLeaveEnd'].forEach(k=>{if(cfg[k] instanceof Date)cfg[k]=dayKey(cfg[k]);});
  return cfg;
}
function locked(fn) {
  const lock=LockService.getScriptLock(); lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function setup() {
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  const props=PropertiesService.getScriptProperties();
  const owner=props.getProperty('AUTOMATION_OWNER');
  if (owner && owner!==Session.getEffectiveUser().getEmail()) throw new Error('Only the configured automation owner may run setup.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID',ss.getId());
  props.setProperty('AUTOMATION_OWNER',Session.getEffectiveUser().getEmail());
  ss.setSpreadsheetTimeZone('Asia/Kolkata');
  ss.setSpreadsheetLocale('en_IN');
  Object.keys(HEADERS).forEach(name => {
    let s=ss.getSheetByName(name);
    if (!s) s=ss.insertSheet(name);
    if(s.getMaxColumns()<HEADERS[name].length)s.insertColumnsAfter(s.getMaxColumns(),HEADERS[name].length-s.getMaxColumns());
    if (!s.getLastRow()) s.appendRow(HEADERS[name]);
    else {
      const existing=s.getRange(1,1,1,HEADERS[name].length).getValues()[0];
      const suffix=existing.findIndex(v=>v==='');
      const known=suffix<0?existing.length:suffix;
      if(existing.some((v,i)=>i<known?v!==HEADERS[name][i]:v!==''))throw Error('Unknown columns in '+name+'; back up and restore the supported header order.');
      s.getRange(1,1,1,HEADERS[name].length).setValues([HEADERS[name]]);
    }
    s.setFrozenRows(1);
    s.getRange(1,1,1,HEADERS[name].length).setBackground('#173e36').setFontColor('#ffffff').setFontWeight('bold');
    s.autoResizeColumns(1,HEADERS[name].length);
  });
  if (!records('Settings').length) {
    [['ManagerEmail','manager@example.com'],['LeadershipEmail','leadership@example.com'],
      ['AckHours',4],['ResolveHours',24],['DryRun',true]].forEach(([Key,Value])=>save('Settings',{Key,Value}));
  }
  const currentSettings=settings();
  [['BackupManagerEmail',''],['ManagerLeaveStart',''],['ManagerLeaveEnd',''],['WorkingDays','1,2,3,4,5'],['HolidayDates',''],['AnnualPaidLeaveDays',50]].forEach(([Key,Value])=>{if(!(Key in currentSettings))save('Settings',{Key,Value});});
  if (!records('Tasks').length) {
    ['Daily Operations Update','Portal Task A','Portal Task B','Portal Task C'].forEach((Task,i)=>save('Tasks',{
      TaskID:'TASK-'+(i+1), Task, Employee:'Employee '+String.fromCharCode(65+i),
      EmployeeEmail:'employee'+String.fromCharCode(97+i)+'@example.com',
      IntervalDays:[1,7,15,30][i], ProofType:i?'TICKET':'DAILY', StartDate:dayKey(new Date()), DueHour:17, Active:true,RecurrenceMode:'COMPLETION',CalendarPolicy:i?'CALENDAR':'WORKING'
    }));
  }
  const master=ss.getSheetByName('Tasks');
  master.getRange('E2:E').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['1','7','15','30'],true).setAllowInvalid(false).build());
  master.getRange('F2:F').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['DAILY','TICKET'],true).setAllowInvalid(false).build());
  master.getRange('H2:H').setDataValidation(SpreadsheetApp.newDataValidation().requireNumberBetween(0,23).setAllowInvalid(false).build());
  master.getRange('J2:J').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['COMPLETION','FIXED'],true).setAllowInvalid(false).build());
  master.getRange('K2:K').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['CALENDAR','WORKING'],true).setAllowInvalid(false).build());
  records('Tasks').forEach(t=>master.getRange(t._row,9).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build()));
  master.getRange('G2:G').setNumberFormat('yyyy-mm-dd');
  const board=ss.getSheetByName('Workboard');
  if (!board.getFilter()) board.getRange(1,1,board.getMaxRows(),HEADERS.Workboard.length).createFilter();
  records('Workboard').forEach(formatCycle);
  [6,11,13,16,18].forEach(col=>board.getRange(2,col,board.getMaxRows()-1,1).setNumberFormat('dd mmm yyyy hh:mm'));
  board.getRange('H1').setNote('Ticket ID for portal tasks; optional evidence URL or note for daily tasks. Then check Complete.');
  board.getRange('N1').setNote('Manager only: add an action note first, then check Acknowledge.');
  board.getRange('T1').setNote('Manager recovery inputs T:X remain editable after acknowledgement. Check SaveRecovery in Y to append a version to protected RecoveryLog.');
  board.getRange('V2:V').setNumberFormat('dd mmm yyyy hh:mm');
  board.getRange('Y1').setNote('Validate and save recovery history. Unchanged retries do not create another version.');
  board.setColumnWidth(3,240);board.setColumnWidth(8,230);board.setColumnWidth(17,260);board.setColumnWidth(19,300);
  board.getRange('H2:H').setNumberFormat('@');
  board.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Overdue').setBackground('#fce3df').setRanges([board.getRange('L2:L')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Completed').setBackground('#daf1df').setRanges([board.getRange('L2:L')]).build()
  ]);
  let dashboard=ss.getSheetByName('Manager');
  if (!dashboard) dashboard=ss.insertSheet('Manager');
  dashboard.getRange('A1').setValue('ALLO / OPERATIONS MONITOR');
  dashboard.getRange('A3').setFormula(`=QUERY(Workboard!A:S,"select D,C,F,L,M,P,R where A is not null and (L = 'Due today' or L = 'Overdue')",1)`);
  dashboard.getRange('I1').setValue('REVIEWS STILL REQUIRED (INCLUDING COMPLETED WORK)');
  dashboard.getRange('I3').setFormula(`=QUERY(Workboard!A:S,"select D,C,K,M,Q where A is not null and M is not null and P is null",1)`);
  dashboard.getRange('O1').setValue('MANAGER SCORECARD');
  const scorecard = [
    ['Open overdue cycles', '=COUNTIFS(Workboard!A2:A,"<>",Workboard!F2:F,"<="&NOW(),Workboard!K2:K,"")'],
    ['Open due later today', '=COUNTIFS(Workboard!A2:A,"<>",Workboard!F2:F,">"&NOW(),Workboard!F2:F,"<"&TODAY()+1,Workboard!K2:K,"")'],
    ['Reviews beyond acknowledgement SLA', '=COUNTIFS(Workboard!A2:A,"<>",Workboard!M2:M,">0",Workboard!M2:M,"<="&NOW()-VALUE(VLOOKUP("AckHours",Settings!A:B,2,FALSE))/24,Workboard!P2:P,"")'],
    ['Open work beyond resolution SLA', '=COUNTIFS(Workboard!A2:A,"<>",Workboard!M2:M,">0",Workboard!M2:M,"<="&NOW()-VALUE(VLOOKUP("ResolveHours",Settings!A:B,2,FALSE))/24,Workboard!K2:K,"")'],
    ['Delivery entries needing owner review', '=COUNTIF(EmailLog!G2:G,"SENDING")+COUNTIF(EmailLog!G2:G,"REVIEW_REQUIRED")'],
    ['Completed cycles retained', '=COUNTIFS(Workboard!A2:A,"<>",Workboard!K2:K,">0")'],
    ['Calculated at spreadsheet refresh', '=NOW()']
  ];
  scorecard.forEach(([label,formula],i)=>{
    dashboard.getRange(i+3,15).setValue(label);
    dashboard.getRange(i+3,16).setFormula(formula);
  });
  dashboard.getRange('P9').setNumberFormat('dd mmm yyyy hh:mm');
  dashboard.getRange('O11').setValue('Live counts across retained cycles; includes dry-run activity. Check Health for automation heartbeat.');
  dashboard.setColumnWidth(15,340);dashboard.setColumnWidth(16,180);
  dashboard.getRange('R1').setValue('RECOVERY DRAFT INPUTS AND SAVED VERSION NUMBER');
  dashboard.getRange('R3').setFormula(`=QUERY(Workboard!A:AD,"select C,T,U,V,W,X,AA where A is not null and (L = 'Overdue' or AA > 0)",1)`);
  dashboard.getRange('U4:U').setNumberFormat('dd mmm yyyy hh:mm');
  dashboard.getRange('C4:C').setNumberFormat('dd mmm yyyy hh:mm');
  dashboard.getRange('E4:G').setNumberFormat('dd mmm yyyy hh:mm');
  dashboard.getRange('K4:L').setNumberFormat('dd mmm yyyy hh:mm');
  dashboard.getRange('A1:G1').setBackground('#173e36').setFontColor('white').setFontWeight('bold');
  dashboard.setFrozenRows(3); dashboard.autoResizeColumns(1,7);
  ensureLeaveQueue_();
  runAutomation();
  protectWorkbook();
  runHealthCheck();
}
function installTriggers() {
  requireOwner();validateSettings(settings());
  const names=['runAutomation','handleEdit'];
  ScriptApp.getProjectTriggers().filter(t=>names.includes(t.getHandlerFunction())).forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('runAutomation').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('handleEdit').forSpreadsheet(book()).onEdit().create();
  runHealthCheck();
}
function ensureCycles(now) {
  const cycles=records('Workboard');
  const calendar=calendarFor(settings());
  const tasks=records('Tasks');const ids=new Set();
  tasks.forEach(t=>{
    if (ids.has(String(t.TaskID))) throw new Error('Duplicate TaskID: '+t.TaskID);
    ids.add(String(t.TaskID));validateTask(t);
    if (![true,false].includes(t.Active)) throw new Error('Active must be a checkbox TRUE or FALSE: '+t.TaskID);
  });
  tasks.filter(t=>t.Active===true).forEach(t=>{
    const history=cycles.filter(c=>c.TaskID===t.TaskID);
    if (history.some(c=>!c.CompletedAt)) return;
    const last=history.sort((a,b)=>new Date(b.CompletedAt)-new Date(a.CompletedAt))[0];
    const start=t.StartDate instanceof Date ? dayKey(t.StartDate) : String(t.StartDate);
    const schedule=last?nextSchedule(t,last.CompletedAt,last.DueAt,calendar):{due:dateAt(firstDay(start,(t.CalendarPolicy||(t.ProofType==='DAILY'?'WORKING':'CALENDAR'))==='WORKING',calendar),Number(t.DueHour)),skipped:0};
    const due=schedule.due;
    if (!Number.isFinite(due.getTime())) throw new Error('Invalid start date: '+t.TaskID);
    const cycle=cycleFor(t,due);
    cycle.SkippedOccurrences=schedule.skipped;
    cycle.Status=statusFor(cycle,now);
    if (!cycles.some(c=>c.CycleID===cycle.CycleID)) {save('Workboard',cycle);protectCycle(cycle);formatCycle(cycle);cycles.push(cycle);}
  });
}
function handleEdit(e) {
  if (!e || e.range.getSheet().getName()!=='Workboard' || e.range.getRow()<2) return;
  const first=e.range.getColumn(),last=e.range.getLastColumn();
  const completeEdited=first<=9 && last>=9,ackEdited=first<=14 && last>=14;
  const recoveryEdited=first<=25&&last>=25;
  if (!completeEdited && !ackEdited && !recoveryEdited) return;
  locked(()=>{
    // Process each edited row, including paste operations. Never infer identity
    // from the trigger owner: only the actual event user is accepted.
    const actor=e.user ? String(e.user.getEmail()).trim().toLowerCase() : '';
    const cfg=settings(); const now=new Date();
    records('Workboard').filter(c=>c._row>=e.range.getRow() && c._row<=e.range.getLastRow()).forEach(c=>{
      c.Error='';
      if (completeEdited && c.Complete===true && !c.CompletedAt) {
        c.Error=!actor?'Editor identity unavailable. Use a Workspace account with visible identity.':actor.toLowerCase()!==String(c.EmployeeEmail).toLowerCase()?'Only the assigned employee may complete this cycle.':dayKey(c.DueAt)>dayKey(now)?'This cycle is not due yet.':completionError(c);
        if (c.Error) c.Complete=false;
        else {c.CompletedBy=actor;c.CompletedAt=now;}
      }
      if (ackEdited && c.Acknowledge===true && !c.AcknowledgedAt) {
        if (!actor || !reviewerEmails(c,cfg,now).includes(actor) || !String(c.ManagerNote).trim() || !c.ManagerAlertAt) {
          c.Acknowledge=false;c.Error='Manager identity, action note and a manager alert are required.';
        } else { c.AcknowledgedAt=now;c.AcknowledgedBy=actor; }
      }
      if(recoveryEdited&&c.SaveRecovery===true) {
        const error=saveRecovery(c,actor,cfg,now);
        if(error)c.Error=error;
        e.range.getSheet().getRange(c._row,25).setValue(false);
      }
      c.Status=statusFor(c,now);save('Workboard',c);
      if (c.Error) {
        const sheet=e.range.getSheet();
        if (completeEdited && c.Complete===false) sheet.getRange(c._row,9).setValue(false);
        if (ackEdited && c.Acknowledge===false) sheet.getRange(c._row,14).setValue(false);
      }
      protectCycle(c);
    });
    ensureCycles(now);
  });
}
function deliver(c,stage,cfg,now) {
  validateSettings(cfg);
  const key=c.CycleID+':'+stage;
  if (records('EmailLog').some(r=>r.Key===key)) return;
  const recipient=String(stage==='MANAGER'?activeManager(cfg,now):cfg.LeadershipEmail).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('Invalid recipient in Settings');
  const dry=String(cfg.DryRun).toLowerCase()==='true';
  if (!dry && /@example\.com$/i.test(recipient)) throw new Error('Replace sample recipients before enabling live email');
  const entry={Key:key,CycleID:c.CycleID,Stage:stage,Recipient:recipient,CreatedAt:now,SentAt:'',DeliveryStatus:dry?'DRY_RUN':'SENDING',Error:''};
  // Reserve the key before sending: ambiguous delivery is held for manual review,
  // rather than automatically sending an email twice after an interrupted run.
  save('EmailLog',entry);
  if (!dry) {
    try {
      const at=d=>d?Utilities.formatDate(new Date(d),'Asia/Kolkata','dd MMM yyyy HH:mm')+' IST':'No';
      MailApp.sendEmail(recipient,'[Allo '+stage+'] '+c.Task+' / '+c.Employee,
        'Cycle: '+c.CycleID+'\nEmployee: '+c.Employee+'\nDue: '+at(c.DueAt)+
        '\nCompleted: '+at(c.CompletedAt)+'\nManager acknowledged: '+at(c.AcknowledgedAt)+
        '\nReview SLA: '+cfg.AckHours+' elapsed hours. Resolution SLA: '+cfg.ResolveHours+' elapsed hours after manager alert.'+
        '\nAction: open Workboard, resolve the task; manager adds an action note and checks Acknowledge.\n'+book().getUrl());
      entry.SentAt=now;entry.DeliveryStatus='SENT';
    } catch(err) {entry.DeliveryStatus='REVIEW_REQUIRED';entry.Error=String(err);save('EmailLog',entry);throw err;}
    save('EmailLog',entry);
  }
}
function runAutomation() {
  requireOwner();
  locked(()=>{
    const now=new Date(),cfg=settings();
    validateSettings(cfg);
    processLeaveQueue_();
    ensureCycles(now);
    records('Workboard').forEach(c=>{
      const priorStatus=c.Status,priorError=c.Error;
      c.Status=statusFor(c,now);
      const stage=alertFor(c,now,Number(cfg.AckHours),Number(cfg.ResolveHours));
      if (stage) {
        try { deliver(c,stage,cfg,now); }
        catch(err) { c.Error='Alert failed: '+String(err);save('Workboard',c);return; }
        const log=records('EmailLog').find(r=>r.Key===c.CycleID+':'+stage);
        if (log && ['SENT','DRY_RUN'].includes(log.DeliveryStatus)) {
          c[stage==='MANAGER'?'ManagerAlertAt':'LeadershipAlertAt']=log.SentAt||log.CreatedAt;
          if(stage==='MANAGER')c.ReviewOwnerEmail=log.Recipient;
        }
        else c.Error='Email delivery needs review in EmailLog.';
      }
      // Successful recovery clears mail errors, preserving validation errors.
      if (String(c.Error).startsWith('Alert failed:') || c.Error==='Email delivery needs review in EmailLog.') {
        const attempts=records('EmailLog').filter(r=>r.CycleID===c.CycleID);
        if(attempts.length && attempts.every(r=>['SENT','DRY_RUN'].includes(r.DeliveryStatus)))c.Error='';
      }
      if (stage || priorStatus!==c.Status || priorError!==c.Error) save('Workboard',c);
      protectCycle(c);
    });
    refreshWeeklyReport();
    PropertiesService.getScriptProperties().setProperty('LAST_SUCCESSFUL_RUN',now.toISOString());
  });
}

// The spreadsheet owner is necessarily trusted: Google Sheets owners can always edit.
function restrict(protection, emails) {
  protection.setWarningOnly(false);
  protection.addEditor(Session.getEffectiveUser());
  const owner=Session.getEffectiveUser().getEmail();
  const remove=protection.getEditors().filter(u=>u.getEmail()!==owner);
  if (remove.length) protection.removeEditors(remove);
  emails.filter(e=>e && !/@example\.com$/i.test(e)).forEach(e=>protection.addEditor(e));
  if (protection.canDomainEdit()) protection.setDomainEdit(false);
}
function protectCycle(c) {
  const s=book().getSheetByName('Workboard');
  const cfg=settings();
  const reviewers=reviewerEmails(c,cfg,new Date());
  [['H'+c._row+':I'+c._row,c.CompletedAt?[]:[String(c.EmployeeEmail)]],
    ['N'+c._row,c.AcknowledgedAt?[]:reviewers],['Q'+c._row,c.AcknowledgedAt?[]:reviewers],
    ['T'+c._row+':Y'+c._row,reviewers]].forEach(([a,emails])=>{
    const description='ALLO:'+c.CycleID+':'+a;
    let pr=s.getProtections(SpreadsheetApp.ProtectionType.RANGE).find(p=>p.getDescription()===description);
    if (!pr) pr=s.getRange(a).protect().setDescription(description);
    restrict(pr,emails);
  });
  refreshInputExemptions();
}
function protectWorkbook() {
  book().getSheets().filter(s=>Object.keys(HEADERS).concat(['Manager','Health','Guide','RuleTests','Weekly']).includes(s.getName())).forEach(s=>{
    let pr=s.getProtections(SpreadsheetApp.ProtectionType.SHEET).find(p=>p.getDescription()==='ALLO:system');
    if (!pr) pr=s.protect().setDescription('ALLO:system');
    restrict(pr,s.getName()==='LeaveQueue'?[...records('Tasks').map(t=>t.EmployeeEmail),settings().ManagerEmail,settings().BackupManagerEmail]:[]);
  });
  records('Workboard').forEach(protectCycle);
  refreshInputExemptions();
}
function refreshInputExemptions() {
  const sheet=book().getSheetByName('Workboard');
  const protection=sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).find(p=>p.getDescription()==='ALLO:system');
  if (!protection) return;
  const ranges=[];
  records('Workboard').forEach(c=>{
    if (!c.CompletedAt) ranges.push(sheet.getRange(c._row,8,1,2));
    if (!c.AcknowledgedAt) ranges.push(sheet.getRange(c._row,14),sheet.getRange(c._row,17));
    ranges.push(sheet.getRange(c._row,20,1,6));
  });
  protection.setUnprotectedRanges(ranges);
}
function formatCycle(c) {
  const s=book().getSheetByName('Workboard');
  [9,14,25].forEach(col=>s.getRange(c._row,col).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build()));
  [6,11,13,16,18].forEach(col=>s.getRange(c._row,col).setNumberFormat('dd mmm yyyy hh:mm'));
  s.getRange(c._row,8).setNumberFormat('@');
  s.getRange(c._row,22).setNumberFormat('dd mmm yyyy hh:mm');
}
function saveRecovery(c,actor,cfg,now) {
  if(!actor||!reviewerEmails(c,cfg,now).includes(actor))return 'Only an authorized manager may save recovery history.';
  const error=recoveryError(c);if(error)return error;
  const history=records('RecoveryLog').filter(h=>h.CycleID===c.CycleID).sort((a,b)=>Number(b.Revision)-Number(a.Revision));
  const previous=history[0];
  const fields=['Blocker','RecoveryOwner','RecoveryTargetAt','NextAction','ResolutionNote'];
  const value=(o,k)=>k==='RecoveryTargetAt'?new Date(o[k]).toISOString():String(o[k]||'').trim();
  const changes=fields.filter(k=>!previous||value(previous,k)!==value(c,k));
  if(!changes.length){c.RecoveryRevision=Number(previous.Revision);return '';}
  const revision=previous?Number(previous.Revision)+1:1;
  const entry={EntryID:c.CycleID+':RECOVERY:'+revision,CycleID:c.CycleID,Revision:revision,UpdatedAt:now,UpdatedBy:actor,ChangeSummary:changes.join(', ')};
  fields.forEach(k=>entry[k]=k==='RecoveryTargetAt'?new Date(c[k]):String(c[k]||'').trim());
  save('RecoveryLog',entry);c.RecoveryRevision=revision;
  return '';
}
function refreshWeeklyReport() {
  requireOwner();
  const ss=book(),cfg=settings();
  const summary=weeklySummary(records('Workboard'),records('RecoveryLog'),new Date(),Number(cfg.AckHours));
  let s=ss.getSheetByName('Weekly');if(!s)s=ss.insertSheet('Weekly');
  s.clearContents();
  const rate=(n,d)=>d?n+'/'+d+' ('+Math.round(n/d*100)+'%)':'N/A (0 eligible cycles)';
  const rows=[['WEEKLY MANAGEMENT REPORT','VALUE'],['Week starting IST',summary.start],['Week ending exclusive',summary.end],['As of',summary.asOf],
    ['On-time generated cycles',rate(summary.onTimeCount,summary.dueCount)],['Review compliance',rate(summary.compliantReviewCount,summary.reviewCount)],
    ['Overdue carryover from prior weeks',summary.carryover],['All overdue at report cutoff',summary.overdue],
    ['Overdue under 24h / 24-72h / 72h+',summary.ageBuckets.join(' / ')],['Skipped fixed-schedule dates on cycles due in this window',summary.skippedOccurrences],
    ['Definition','Monday 00:00 IST to earlier of next Monday or report time, current snapshots include the cutoff instant; completed weeks exclude next Monday. Includes unresolved due cycles; zero denominator is N/A.'],
    ['Evidence boundary','Includes retained dry-run/test data. Generated cycles are not a ledger of every missed daily occurrence.'],
    ['BLOCKER AT CUTOFF','OPEN CYCLES AND LATEST SAVED ACTIONS'],
    ...summary.blockers.map(b=>[b.label,(b.count>1?'Repeated across ':'')+b.count+' cycle(s); '+(b.actions.join(' | ')||'Manager action required')])];
  s.getRange(1,1,rows.length,2).setValues(rows);s.getRange(1,1,1,2).setBackground('#173e36').setFontColor('white').setFontWeight('bold');
  s.getRange('B4').setNumberFormat('dd mmm yyyy hh:mm');s.setColumnWidth(1,380);s.setColumnWidth(2,850);s.setFrozenRows(1);
  let p=s.getProtections(SpreadsheetApp.ProtectionType.SHEET).find(p=>p.getDescription()==='ALLO:system');if(!p)p=s.protect().setDescription('ALLO:system');restrict(p,[]);
  return summary;
}
function requireOwner() {
  const owner=PropertiesService.getScriptProperties().getProperty('AUTOMATION_OWNER');
  if (!owner || owner!==Session.getEffectiveUser().getEmail()) throw new Error('Run this action as the configured automation owner.');
}
function compactWorkboard() {
  requireOwner();
  locked(()=>{
    const s=book().getSheetByName('Workboard'),rows=records('Workboard');
    if(!rows.length || rows.every((r,i)=>r._row===i+2))return;
    const values=rows.map(r=>HEADERS.Workboard.map(h=>r[h]));
    // Preserve all cycle data before changing coordinates. EmailLog is untouched.
    const backup=book().insertSheet('Workboard_Backup_'+new Date().getTime());
    backup.getRange(1,1,1,HEADERS.Workboard.length).setValues([HEADERS.Workboard]);
    backup.getRange(2,1,values.length,HEADERS.Workboard.length).setValues(values);
    restrict(backup.protect().setDescription('ALLO:backup'),[]);
    SpreadsheetApp.flush();
    if(s.getFilter())s.getFilter().remove();
    s.getProtections(SpreadsheetApp.ProtectionType.RANGE).filter(p=>p.getDescription().startsWith('ALLO:')).forEach(p=>p.remove());
    s.getRange(2,1,s.getLastRow()-1,HEADERS.Workboard.length).clearContent();
    s.getRange(2,1,values.length,HEADERS.Workboard.length).setValues(values);
    rows.forEach((r,i)=>{r._row=i+2;formatCycle(r);});
    protectWorkbook();
    s.getRange(1,1,s.getMaxRows(),HEADERS.Workboard.length).createFilter();
    SpreadsheetApp.flush();
  });
}


/* Owner-run deployment diagnostics. These checks do not send test emails. */
function runHealthCheck() {
  requireOwner();
  const rows=[],cfg=settings(),tasks=records('Tasks');
  const check=(name,fn)=>{try {rows.push([name,'PASS',String(fn()||'OK')]);}catch(err){rows.push([name,'FAIL',String(err.message||err)]);}};
  check('Settings',()=>validateSettings(cfg));
  check('Paid leave entitlement',()=>leaveEntitlement(cfg)+' full working days per unique employee email per calendar year');
  check('Task configuration',()=>{
    const ids=new Set();
    tasks.forEach(t=>{validateTask(t);if(ids.has(t.TaskID))throw new Error('Duplicate ID '+t.TaskID);ids.add(t.TaskID);});
    return tasks.length+' task definitions validated';
  });
  check('Timezone',()=>{if(book().getSpreadsheetTimeZone()!=='Asia/Kolkata')throw new Error('Expected Asia/Kolkata');});
  check('Five-minute automation trigger',()=>{
    const count=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='runAutomation').length;
    if(count!==1)throw new Error('Expected one timer trigger; use Install automation triggers');
    return 'One timer trigger visible to current owner; schedule configured by installer';
  });
  check('Edit trigger',()=>{
    const count=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='handleEdit').length;
    if(count!==1)throw new Error('Expected one edit trigger; use Install automation triggers');
  });
  check('Real employee accounts',()=>{if(tasks.filter(t=>t.Active===true).some(t=>isSampleEmail(t.EmployeeEmail)))throw new Error('Replace sample employee emails, share the Sheet, then rerun setup');});
  check('Email delivery reservations',()=>{
    const review=records('EmailLog').filter(r=>['SENDING','REVIEW_REQUIRED'].includes(r.DeliveryStatus));
    if(review.length)throw new Error(review.length+' ambiguous/failed delivery entries need manual review');
  });
  check('Automation heartbeat',()=>{
    const last=PropertiesService.getScriptProperties().getProperty('LAST_SUCCESSFUL_RUN');
    const timestamp=last ? new Date(last).getTime() : NaN;
    if(!Number.isFinite(timestamp))throw new Error('Missing or invalid automation heartbeat; inspect trigger executions');
    const age=new Date().getTime()-timestamp;
    if(age < -60000)throw new Error('Automation heartbeat is more than one minute in the future; inspect timestamp and clock');
    if(age>15*60000)throw new Error('No successful automation run within 15 minutes; inspect trigger executions');
    return last;
  });
  check('No duplicate cycles or email keys',()=>{
    for(const [name,key] of [['Workboard','CycleID'],['EmailLog','Key'],['RecoveryLog','EntryID']]) {
      const values=records(name).map(r=>r[key]);if(new Set(values).size!==values.length)throw new Error('Duplicate '+key+' in '+name);
    }
  });
  check('Workboard protections',()=>{
    const s=book().getSheetByName('Workboard');
    if(!s.getProtections(SpreadsheetApp.ProtectionType.SHEET).some(p=>p.getDescription()==='ALLO:system'))throw new Error('Run setup to apply system protection');
    const descriptions=s.getProtections(SpreadsheetApp.ProtectionType.RANGE).map(p=>p.getDescription());
    records('Workboard').forEach(c=>['H'+c._row+':I'+c._row,'N'+c._row,'Q'+c._row,'T'+c._row+':Y'+c._row].forEach(a=>{
      if(!descriptions.includes('ALLO:'+c.CycleID+':'+a))throw new Error('Missing protection for '+c.CycleID+' '+a);
    }));
    return 'Protection objects present; verify actual users manually';
  });
  check('Remaining mail quota',()=>{const n=MailApp.getRemainingDailyQuota();if(n<2)throw new Error('Insufficient daily quota');return n+' recipients remaining';});
  rows.push(['Delivery mode',String(cfg.DryRun).toLowerCase()==='true'?'DRY_RUN':'LIVE','Dry-run entries do not prove receipt. Use a fresh copy for live operation.']);
  rows.push(['Real-user identity and receipt','MANUAL','Verify employee/manager edits and actual email receipts; this check cannot authenticate other users.']);
  let s=book().getSheetByName('Health');if(!s)s=book().insertSheet('Health');
  s.clearContents();s.getRange(1,1,1,3).setValues([['CHECK','RESULT','DETAIL']]);
  s.getRange(2,1,rows.length,3).setValues(rows);
  s.getRange(1,1,1,3).setBackground('#173e36').setFontColor('white').setFontWeight('bold');
  s.setFrozenRows(1);s.setColumnWidth(1,260);s.setColumnWidth(2,100);s.setColumnWidth(3,700);
  s.getRange(rows.length+3,1).setValue('Checked at '+Utilities.formatDate(new Date(),'Asia/Kolkata','yyyy-MM-dd HH:mm:ss')+' IST');
  let pr=s.getProtections(SpreadsheetApp.ProtectionType.SHEET).find(p=>p.getDescription()==='ALLO:system');
  if(!pr)pr=s.protect().setDescription('ALLO:system');restrict(pr,[]);
  return rows;
}


// Gaurang is a read-only, record-based assistant. No external model or data transfer.
function gaurangAnswer(question, snapshot) {
  const q=String(question||'').trim();
  if(!q||q.length>1000)throw new Error('Enter a question between 1 and 1,000 characters.');
  const text=q.toLowerCase(),now=new Date(snapshot.now),cfg=snapshot.settings;
  const all=snapshot.cycles||[],history=snapshot.history||[],tasks=snapshot.tasks||[];
  const stamp=Utilities.formatDate(now,'Asia/Kolkata','yyyy-MM-dd HH:mm');
  const reply=(answer,sources)=>({answer,sources,asOf:stamp+' IST',mode:snapshot.mode||'demo'});
  const date=value=>value?Utilities.formatDate(new Date(value),'Asia/Kolkata','yyyy-MM-dd HH:mm')+' IST':'Not recorded';
  // Record contents are data, never instructions. No prompt or code execution occurs.
  if(/\b(delete|send|update|change|approve|mark|complete|acknowledge|save)\b/.test(text)&&!/\b(how|why|when|who|what|which|show|list|is|are|has|have|was|were)\b/.test(text))
    return reply('I can explain and look up records, but I cannot change tasks, approve leave or send messages. Use the Workboard or Calendar & coverage controls.',['Website workflow']);
  const employeeMatch=text.match(/\bemployee\s+([a-d])\b/),employee=employeeMatch?'Employee '+employeeMatch[1].toUpperCase():null;
  let rows=all.filter(c=>!employee||c.Employee===employee);
  const matchedTasks=tasks.filter(t=>text.includes(String(t.Task).toLowerCase())||text.includes(String(t.TaskID).toLowerCase()));
  if(matchedTasks.length)rows=rows.filter(c=>matchedTasks.some(t=>t.TaskID===c.TaskID));
  if(/\b(recurrence|recurring|repeat|interval|how often|frequency)\b/.test(text)) {
    const policies=(matchedTasks.length?matchedTasks:tasks).filter(t=>!employee||t.Employee===employee);
    return reply(policies.map(t=>t.Task+': every '+t.IntervalDays+' calendar day(s); '+(t.RecurrenceMode==='FIXED'?'fixed schedule anchored at '+t.StartDate:'next date follows completion')+'; '+(t.CalendarPolicy==='WORKING'?'rolled to allowed working days and holidays':'calendar days')+'.').join('\n')||'No matching task policies recorded.',['Tasks: IntervalDays, RecurrenceMode, CalendarPolicy, StartDate','Settings: business calendar']);
  }
  if(/\b(leave|leaves|holiday|holidays|coverage|backup|substitute|working days|weekend)\b/.test(text)) {
    if(employee||/\b(employee|employees|balance|balances|request|requests|sick|annual)\b/.test(text))
    {
      if(!Array.isArray(snapshot.leaveRequests))return reply('Employee leave records are unavailable in this snapshot. Open Paid leave for the current ledger.',['LeaveRequests: unavailable']);
      const year=Number((text.match(/\b20\d{2}\b/)||[])[0]||dayKey(now).slice(0,4));
      const emails=[...new Set(tasks.filter(t=>!employee||t.Employee===employee).map(t=>String(t.EmployeeEmail).toLowerCase()))];
      return reply(emails.map(email=>{const b=leaveBalance(snapshot.leaveRequests,email,year,cfg);return email+': '+b.remaining+'/'+b.entitlement+' days available in '+year+'; '+b.approved+' approved/reserved; '+b.pending+' pending.';}).join('\n')+'\nEntitlement is per unique email. Approved future leave reserves balance; pending requests do not. Task completion does not prove employee availability.',['LeaveRequests: paid leave ledger','Settings: AnnualPaidLeaveDays (default 50)']);
    }
    const cal=calendarFor(cfg),days=cal.days.map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ');
    return reply('Current manager alert owner: '+activeManager(cfg,now)+'.\nPrimary: '+cfg.ManagerEmail+'.\n'+(cfg.ManagerLeaveStart?'Manager leave: '+cfg.ManagerLeaveStart+' to '+cfg.ManagerLeaveEnd+' inclusive. Backup: '+cfg.BackupManagerEmail+'. New alerts return to the primary afterward.':'No manager leave window is configured.')+'\nWorking days: '+days+'. Holidays: '+(cfg.HolidayDates||'None configured')+'. Existing incidents retain their original reviewer.',['Settings: ManagerEmail, BackupManagerEmail, ManagerLeaveStart/End, WorkingDays, HolidayDates']);
  }
  if(/\b(how|why)\b/.test(text)&&/\b(complete|completed|completion|acknowledge|acknowledged|review|recurrence|recurring|escalat\w*)\b/.test(text))
    return reply('Employee completion and manager acknowledgement are separate. Employees enter evidence and complete a cycle on Workboard; the next cycle is generated using its recurrence policy. Managers add a note and acknowledge review; this does not complete employee work. Recovery plans retain version history. Review is due after '+cfg.AckHours+' elapsed hours; unresolved work escalates after '+cfg.ResolveHours+' elapsed hours.',['Website workflow','Settings: AckHours, ResolveHours','Tasks: recurrence policies']);
  if(/\b(report|weekly|performance|compliance|on.time|carryover)\b/.test(text)) {
    const requested=text.match(/\b\d{4}-\d{2}-\d{2}\b/);let start;
    if(requested){if(!validDay(requested[0]))return reply('That date is invalid. Use YYYY-MM-DD.',['Reporting calendar']);const day=requested[0],wd=new Date(+dateAt(day,12)+19800000).getUTCDay();start=addDays(day,-((wd+6)%7));}
    const s=weeklySummary(rows,history,now,Number(cfg.AckHours),start);
    const rate=(n,d)=>d?n+'/'+d+' ('+Math.round(n/d*100)+'%)':'N/A (0/0)';
    return reply('Week '+s.start+' to '+s.end+' (next Monday excluded).\nOn-time completion: '+rate(s.onTimeCount,s.dueCount)+'.\nReview compliance: '+rate(s.compliantReviewCount,s.reviewCount)+'.\nOverdue carryover: '+s.carryover+'. All overdue: '+s.overdue+'.\nReport cutoff: '+date(s.asOf)+'. Generated-cycle metrics include unresolved work; they are not a full missed-occurrence ledger.',['Workboard: due, completion and review timestamps','RecoveryLog: saved recovery versions']);
  }
  const recovery=/\b(blocker|blockers|recovery|recoveries|next action|resolution)\b/.test(text);
  const review=/\b(review|reviews|acknowledgement|acknowledgment|acknowledged|unreviewed)\b/.test(text);
  const completed=/\b(completed|finished|done)\b/.test(text);
  const overdue=/\b(overdue|late|delayed)\b/.test(text);
  const upcoming=/\b(upcoming|next|future)\b/.test(text)&&!recovery;
  const taskQuestion=matchedTasks.length||employee||/\b(task|tasks|work|pending|open|due|status|summary|overview|attention|priority|priorities|escalated|evidence|ticket|tickets)\b/.test(text)||review||recovery||completed||overdue||upcoming;
  if(taskQuestion){
    if(review)rows=rows.filter(c=>c.ManagerAlertAt&&(!/\backnowledged\b/.test(text)?!c.AcknowledgedAt:!!c.AcknowledgedAt));
    if(completed)rows=rows.filter(c=>c.CompletedAt);
    if(overdue)rows=rows.filter(c=>statusFor(c,now)==='Overdue');
    if(upcoming)rows=rows.filter(c=>statusFor(c,now)==='Upcoming');
    if(/\bescalated\b/.test(text))rows=rows.filter(c=>c.LeadershipAlertAt);
    if(/\btoday\b/.test(text))rows=rows.filter(c=>dayKey(completed?c.CompletedAt:c.DueAt)===dayKey(now));
    if(/\b(pending|open|attention|priority|priorities)\b/.test(text)||recovery)rows=rows.filter(c=>!c.CompletedAt);
    const order=rows.slice().sort((a,b)=>+new Date(a.DueAt)-+new Date(b.DueAt));
    if(!order.length)return reply('No matching recorded cycles'+(employee?' for '+employee:'')+'. This does not prove no work or leave exists outside these records.',['Workboard']);
    const lines=order.slice(0,12).map(c=>{
      let line=c.Task+' · '+c.Employee+' · '+statusFor(c,now)+'\nDue: '+date(c.DueAt)+'. Review: '+(c.AcknowledgedAt?'acknowledged '+date(c.AcknowledgedAt):c.ManagerAlertAt?'awaiting acknowledgement':'not requested')+'.';
      if(c.CompletedAt)line+=' Completed: '+date(c.CompletedAt)+' by '+c.CompletedBy+'. Evidence: '+(c.Proof||'Daily attestation')+'.';
      else if(/\b(evidence|ticket|tickets)\b/.test(text))line+=' Draft evidence: '+(c.Proof||'Not recorded')+'.';
      if(recovery){const h=history.filter(h=>h.CycleID===c.CycleID&&+new Date(h.UpdatedAt)<=+now).sort((a,b)=>+new Date(b.UpdatedAt)-+new Date(a.UpdatedAt))[0];line+=h?'\nSaved recovery v'+h.Revision+': '+h.Blocker+'; owner '+h.RecoveryOwner+'; target '+date(h.RecoveryTargetAt)+'; next action '+h.NextAction+'.':'\nNo saved recovery plan recorded.';}
      return line;
    });
    return reply(order.length+' matching recorded cycle'+(order.length===1?'':'s')+(order.length>12?' (showing earliest 12)':'')+'.\n\n'+lines.join('\n\n'),order.slice(0,12).map(c=>'Workboard: '+c.CycleID).concat(recovery?['RecoveryLog: latest saved versions']:[]));
  }
  return reply('I do not have recorded information to answer that question. Ask about tasks, an employee, overdue work, manager reviews, saved recovery plans, manager leave coverage, holidays or weekly reports. I do not browse websites or answer general-knowledge questions. Each question is independent; include the task or employee name.',['Available scope: Tasks, Workboard, Settings, RecoveryLog and website workflow']);
}

function requireGaurangManager_() {
  const email=String(Session.getActiveUser().getEmail()||'').toLowerCase(),cfg=settings();
  if(!email||![cfg.ManagerEmail,activeManager(cfg,new Date())].some(v=>String(v||'').toLowerCase()===email))
    throw new Error('Gaurang is available to the primary manager or active approved backup. Sign in with an identifiable authorized account.');
  return cfg;
}
function askGaurang(question) {
  const cfg=requireGaurangManager_();
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{return gaurangAnswer(question,{now:new Date(),settings:cfg,tasks:records('Tasks'),cycles:records('Workboard'),history:records('RecoveryLog'),leaveRequests:leaveRead_(),mode:'live'});}
  finally{lock.releaseLock();}
}
function openGaurang() {
  requireGaurangManager_();
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Gaurang').setTitle('Gaurang · Operations assistant'));
}


// Calendar-year paid leave, one entitlement per unique employee email.
function leaveDays(start,end,cfg) {
  if(!validDay(start)||!validDay(end)||end<start)throw Error('Enter a valid inclusive date range.');
  if(start.slice(0,4)!==end.slice(0,4))throw Error('Split requests at the calendar-year boundary.');
  const cal=calendarFor(cfg);let count=0;
  for(let day=start;day<=end;day=addDays(day,1))if(workingDay(day,cal))count++;
  if(!count)throw Error('The request contains no configured working days.');
  return count;
}
function leaveEntitlement(cfg){const days=cfg.AnnualPaidLeaveDays===undefined?50:Number(cfg.AnnualPaidLeaveDays);if(!Number.isInteger(days)||days<0||days>366)throw Error('AnnualPaidLeaveDays must be an integer from 0 to 366.');return days;}
function leaveBalance(rows,email,year,cfg) {
  const own=rows.filter(r=>String(r.EmployeeEmail).toLowerCase()===email.toLowerCase()&&Number(r.Year)===Number(year));
  const approved=own.filter(r=>r.Status==='APPROVED').reduce((n,r)=>n+Number(r.Days),0),pending=own.filter(r=>r.Status==='PENDING').reduce((n,r)=>n+Number(r.Days),0);
  const entitlement=leaveEntitlement(cfg);return {year:Number(year),entitlement,approved,pending,remaining:entitlement-approved};
}
function leaveCreate(rows,input,actor,tasks,cfg,now) {
  const email=String(actor||'').toLowerCase();
  if(!email||!tasks.some(t=>String(t.EmployeeEmail).toLowerCase()===email&&t.Active!==false))throw Error('Only an identified assigned employee may request leave.');
  if(!/^LR-[a-zA-Z0-9-]{8,80}$/.test(String(input.RequestID)))throw Error('Invalid request reference.');
  const existing=rows.find(r=>r.RequestID===input.RequestID);
  if(existing){if(existing.EmployeeEmail!==email||existing.StartDate!==input.StartDate||existing.EndDate!==input.EndDate)throw Error('Request reference already used.');return existing;}
  const days=leaveDays(input.StartDate,input.EndDate,cfg);
  if(input.StartDate<dayKey(now))throw Error('Requests cannot start in the past.');
  if(rows.some(r=>r.EmployeeEmail===email&&['PENDING','APPROVED'].includes(r.Status)&&r.StartDate<=input.EndDate&&r.EndDate>=input.StartDate))throw Error('Dates overlap an existing pending or approved request.');
  const year=Number(input.StartDate.slice(0,4));
  if(days>leaveBalance(rows,email,year,cfg).remaining)throw Error('Insufficient annual paid-leave balance.');
  return {RequestID:input.RequestID,EmployeeEmail:email,StartDate:input.StartDate,EndDate:input.EndDate,Days:days,Year:year,Status:'PENDING',RequestedAt:new Date(now).toISOString(),DecidedBy:'',DecidedAt:'',DecisionNote:''};
}
function leaveDecision(rows,id,action,actor,cfg,now,note) {
  const r=rows.find(r=>r.RequestID===id);if(!r)throw Error('Leave request not found.');
  const email=String(actor||'').toLowerCase(),manager=[cfg.ManagerEmail,activeManager(cfg,now)].some(v=>String(v||'').toLowerCase()===email);
  if(!email)throw Error('Caller identity is unavailable.');
  if(!['APPROVED','REJECTED','CANCELLED'].includes(action))throw Error('Unsupported leave decision.');
  if(action==='CANCELLED'){
    if(!manager&&!(r.EmployeeEmail===email&&r.Status==='PENDING'))throw Error('Only managers may cancel approved leave; employees may withdraw their pending requests.');
    if(r.Status==='APPROVED'&&r.StartDate<=dayKey(now))throw Error('Approved leave cannot be cancelled once its start date is reached.');
  }else{
    if(!manager)throw Error('Only the primary manager or active approved backup may decide leave.');
    if(r.EmployeeEmail===email)throw Error('Self-approval and self-review are not permitted.');
  }
  if(r.Status===action)return r;
  if(r.Status!=='PENDING'&&!(action==='CANCELLED'&&r.Status==='APPROVED'))throw Error('This request already has a final decision.');
  if(action==='APPROVED'&&Number(r.Days)>leaveBalance(rows,r.EmployeeEmail,r.Year,cfg).remaining)throw Error('Insufficient annual balance at approval time.');
  const comment=String(note||'').trim();if(comment.length>500)throw Error('Decision note exceeds 500 characters.');
  if(['REJECTED','CANCELLED'].includes(action)&&!comment)throw Error('Add a short decision note.');
  return {...r,Status:action,DecidedBy:email,DecidedAt:new Date(now).toISOString(),DecisionNote:comment};
}
function leaveIdentity_(){const email=String(Session.getActiveUser().getEmail()||'').toLowerCase();if(!email)throw Error('Sign in with an identifiable Google account.');return email;}
function leaveRead_(){
  const decisions=new Map();records('LeaveLog').filter(e=>['APPROVED','REJECTED','CANCELLED'].includes(e.Action)).forEach(entry=>decisions.set(entry.RequestID,entry));
  return records('LeaveRequests').map(r=>{
    const entry=decisions.get(r.RequestID);
    return {...r,StartDate:r.StartDate instanceof Date?dayKey(r.StartDate):String(r.StartDate),EndDate:r.EndDate instanceof Date?dayKey(r.EndDate):String(r.EndDate),RequestedAt:r.RequestedAt?new Date(r.RequestedAt).toISOString():'',DecidedAt:r.DecidedAt?new Date(r.DecidedAt).toISOString():'',...(entry?{Status:entry.Action,DecidedBy:entry.Actor,DecidedAt:new Date(entry.At).toISOString(),DecisionNote:entry.Note}:{})};
  });
}
function getLeaveOverview(year) {
  const actor=leaveIdentity_(),cfg=settings(),tasks=records('Tasks'),now=new Date();
  const manager=[cfg.ManagerEmail,activeManager(cfg,now)].some(e=>String(e||'').toLowerCase()===actor);
  const employees=[...new Set(tasks.filter(t=>t.Active!==false).map(t=>String(t.EmployeeEmail).toLowerCase()))];
  if(!manager&&!employees.includes(actor))throw Error('No authorized leave role for this account.');
  const selected=Number(year||dayKey(now).slice(0,4));if(!Number.isInteger(selected)||selected<2000||selected>2100)throw Error('Invalid balance year.');
  const rows=leaveRead_(),receipts=records('LeaveLog'),commands=records('LeaveQueue').map(verifyLeaveCommand_).filter(c=>c&&(manager||c.actor===actor));
  const pending=commands.filter(c=>!receipts.some(r=>r.EntryID==='QUEUE:'+c.QueueID)).length;
  const errors=commands.map(c=>receipts.find(r=>r.EntryID==='QUEUE:'+c.QueueID&&r.Action==='ERROR')).filter(Boolean);
  return {mode:'live',actor,manager,today:dayKey(now),year:selected,balances:(manager?employees:[actor]).map(email=>({email,...leaveBalance(rows,email,selected,cfg)})),requests:rows.filter(r=>Number(r.Year)===selected&&(manager||r.EmployeeEmail===actor)),notice:pending+' command(s) awaiting owner automation (normally up to five minutes).'+(errors.length?' Latest processing error: '+errors[errors.length-1].Note:''),policy:'Calendar year; full working days only; no carryover. Approved future leave reserves balance. Pending leave does not reserve balance.'};
}
function submitLeaveRequest(input) {
  const actor=leaveIdentity_();leaveCreate(leaveRead_(),input,actor,records('Tasks'),settings(),new Date());
  return enqueueLeave_('SUBMIT',input,actor,input.StartDate.slice(0,4));
}
function decideLeaveRequest(id,action,note) {
  const actor=leaveIdentity_(),r=leaveDecision(leaveRead_(),id,action,actor,settings(),new Date(),note);
  return enqueueLeave_('DECIDE',{id,action,note},actor,r.Year);
}
function applyLeaveSubmission_(input,actor) {
  const rows=leaveRead_(),r=leaveCreate(rows,input,actor,records('Tasks'),settings(),new Date());if(!rows.some(x=>x.RequestID===r.RequestID))save('LeaveRequests',r);return r;
}
function applyLeaveDecision_(id,action,note,actor) {
    const rows=leaveRead_(),before=rows.find(r=>r.RequestID===id),r=leaveDecision(rows,id,action,actor,settings(),new Date(),note);
    if(before.Status!==r.Status){
      // Durable decision entry first. Retry reconciles the request after a failed write.
      const key=id+':'+action,entry=records('LeaveLog').find(x=>x.EntryID===key);
      if(entry){Object.assign(r,{DecidedBy:entry.Actor,DecidedAt:entry.At,DecisionNote:entry.Note});}
      else save('LeaveLog',{EntryID:key,RequestID:id,Action:action,Actor:actor,At:r.DecidedAt,Note:r.DecisionNote});
    }
    save('LeaveRequests',r);
    return r;
}
function openLeave(){leaveIdentity_();SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Leave').setTitle('Paid leave'));}
function ensureLeaveQueue_(){const props=PropertiesService.getScriptProperties();if(!props.getProperty('LEAVE_QUEUE_SECRET'))props.setProperty('LEAVE_QUEUE_SECRET',Utilities.getUuid()+Utilities.getUuid());}
function signLeaveCommand_(payload){const secret=PropertiesService.getScriptProperties().getProperty('LEAVE_QUEUE_SECRET');if(!secret)throw Error('Owner must run updated setup before using paid leave.');return Utilities.base64Encode(Utilities.computeHmacSha256Signature(payload,secret));}
function verifyLeaveCommand_(row){try{if(String(row.Payload).length>8000||signLeaveCommand_(String(row.Payload))!==row.Signature)return null;const command=JSON.parse(row.Payload);return command.QueueID===row.QueueID?command:null;}catch(e){return null;}}
function enqueueLeave_(kind,args,actor,year){
  const QueueID=kind==='SUBMIT'?'SUBMIT:'+args.RequestID:'DECIDE:'+args.id+':'+args.action+':'+Utilities.getUuid();
  const existing=records('LeaveQueue').find(r=>r.QueueID===QueueID),verified=existing&&verifyLeaveCommand_(existing);
  if(verified){if(verified.actor!==actor)throw Error('Command already belongs to another account.');return getLeaveOverview(year);}
  const Payload=JSON.stringify({QueueID,kind,args,actor,at:new Date().toISOString()});
  // This shared staging sheet is the only ledger-related sheet callers can write.
  // The owner timer trusts signed payloads only, never editable queue cells alone.
  save('LeaveQueue',{QueueID,Payload,Signature:signLeaveCommand_(Payload)});
  return getLeaveOverview(year);
}
function processLeaveQueue_(){
  requireOwner();
  records('LeaveQueue').forEach(row=>{
    const c=verifyLeaveCommand_(row);if(!c||records('LeaveLog').some(r=>r.EntryID==='QUEUE:'+c.QueueID))return;
    try{
      if(c.kind==='SUBMIT')applyLeaveSubmission_(c.args,c.actor);
      else if(c.kind==='DECIDE')applyLeaveDecision_(c.args.id,c.args.action,c.args.note,c.actor);
      else throw Error('Unknown leave command.');
      save('LeaveLog',{EntryID:'QUEUE:'+c.QueueID,RequestID:c.args.RequestID||c.args.id,Action:'APPLIED',Actor:c.actor,At:new Date().toISOString(),Note:''});
    }catch(error){
      // Write interruptions stay pending for safe retry; validation errors get a receipt.
      if(/interrupted|Service|quota|timed out/i.test(String(error)))return;
      save('LeaveLog',{EntryID:'QUEUE:'+c.QueueID,RequestID:c.args.RequestID||c.args.id,Action:'ERROR',Actor:c.actor,At:new Date().toISOString(),Note:String(error.message||error).slice(0,500)});
    }
  });
}
