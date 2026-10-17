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
