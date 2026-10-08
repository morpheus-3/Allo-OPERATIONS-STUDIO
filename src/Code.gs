const HEADERS = {
  Tasks: ['TaskID','Task','Employee','EmployeeEmail','IntervalDays','ProofType','StartDate','DueHour','Active'],
  Workboard: ['CycleID','TaskID','Task','Employee','EmployeeEmail','DueAt','ProofType','Proof','Complete','CompletedBy','CompletedAt','Status','ManagerAlertAt','Acknowledge','AcknowledgedBy','AcknowledgedAt','ManagerNote','LeadershipAlertAt','Error'],
  Settings: ['Key','Value'],
  EmailLog: ['Key','CycleID','Stage','Recipient','CreatedAt','SentAt','DeliveryStatus','Error']
};
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Allo Operations')
    .addItem('Set up prototype', 'setup').addItem('Run automation now', 'runAutomation')
    .addItem('Install automation triggers', 'installTriggers')
    .addItem('Run health check', 'runHealthCheck').addToUi();
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
  }).filter(obj=>HEADERS[name].some(h=>obj[h]!=='' && obj[h]!==null));
}
function save(name, obj) {
  const s = book().getSheetByName(name);
  const row = HEADERS[name].map(h => obj[h] === undefined ? '' : obj[h]);
  if (obj._row && name==='Workboard') {
    // Refresh generated fields without overwriting concurrent human input.
    [[10,4],[15,2],[18,2]].forEach(([start,length])=>s.getRange(obj._row,start,1,length).setValues([row.slice(start-1,start-1+length)]));
  } else if (obj._row) s.getRange(obj._row,1,1,row.length).setValues([row]);
  else { s.appendRow(row); obj._row=s.getLastRow(); }
  SpreadsheetApp.flush();
}
function settings() {
  const cfg=Object.fromEntries(records('Settings').map(r=>[r.Key,r.Value]));
  ['ManagerEmail','LeadershipEmail'].forEach(k=>{if(cfg[k])cfg[k]=String(cfg[k]).trim().toLowerCase();});
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
    if (!s.getLastRow()) s.appendRow(HEADERS[name]);
    s.setFrozenRows(1);
    s.getRange(1,1,1,HEADERS[name].length).setBackground('#173e36').setFontColor('#ffffff').setFontWeight('bold');
    s.autoResizeColumns(1,HEADERS[name].length);
  });
  if (!records('Settings').length) {
    [['ManagerEmail','manager@example.com'],['LeadershipEmail','leadership@example.com'],
      ['AckHours',4],['ResolveHours',24],['DryRun',true]].forEach(([Key,Value])=>save('Settings',{Key,Value}));
  }
  if (!records('Tasks').length) {
    ['Daily Operations Update','Portal Task A','Portal Task B','Portal Task C'].forEach((Task,i)=>save('Tasks',{
      TaskID:'TASK-'+(i+1), Task, Employee:'Employee '+String.fromCharCode(65+i),
      EmployeeEmail:'employee'+String.fromCharCode(97+i)+'@example.com',
      IntervalDays:[1,7,15,30][i], ProofType:i?'TICKET':'DAILY', StartDate:dayKey(new Date()), DueHour:17, Active:true
    }));
  }
  const master=ss.getSheetByName('Tasks');
  master.getRange('E2:E').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['1','7','15','30'],true).setAllowInvalid(false).build());
  master.getRange('F2:F').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['DAILY','TICKET'],true).setAllowInvalid(false).build());
  master.getRange('H2:H').setDataValidation(SpreadsheetApp.newDataValidation().requireNumberBetween(0,23).setAllowInvalid(false).build());
  master.getRange('I2:I').setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  master.getRange('G2:G').setNumberFormat('yyyy-mm-dd');
  const board=ss.getSheetByName('Workboard');
  if (!board.getFilter()) board.getRange(1,1,board.getMaxRows(),HEADERS.Workboard.length).createFilter();
  [9,14].forEach(col=>board.getRange(2,col,board.getMaxRows()-1,1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build()));
  [6,11,13,16,18].forEach(col=>board.getRange(2,col,board.getMaxRows()-1,1).setNumberFormat('dd mmm yyyy hh:mm'));
  board.getRange('H1').setNote('Ticket ID for portal tasks; optional evidence URL or note for daily tasks. Then check Complete.');
  board.getRange('N1').setNote('Manager only: add an action note first, then check Acknowledge.');
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
  dashboard.getRange('C4:C').setNumberFormat('dd mmm yyyy hh:mm');
  dashboard.getRange('E4:G').setNumberFormat('dd mmm yyyy hh:mm');
  dashboard.getRange('K4:L').setNumberFormat('dd mmm yyyy hh:mm');
  dashboard.getRange('A1:G1').setBackground('#173e36').setFontColor('white').setFontWeight('bold');
  dashboard.setFrozenRows(3); dashboard.autoResizeColumns(1,7);
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
    const due=last?nextDue(t,last.CompletedAt):dateAt(firstDay(start,t.ProofType==='DAILY'),Number(t.DueHour));
    if (!Number.isFinite(due.getTime())) throw new Error('Invalid start date: '+t.TaskID);
    const cycle=cycleFor(t,due);
    cycle.Status=statusFor(cycle,now);
    if (!cycles.some(c=>c.CycleID===cycle.CycleID)) {save('Workboard',cycle);protectCycle(cycle);formatCycle(cycle);cycles.push(cycle);}
  });
}
function handleEdit(e) {
  if (!e || e.range.getSheet().getName()!=='Workboard' || e.range.getRow()<2) return;
  const first=e.range.getColumn(),last=e.range.getLastColumn();
  const completeEdited=first<=9 && last>=9,ackEdited=first<=14 && last>=14;
  if (!completeEdited && !ackEdited) return;
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
        if (!actor || actor.toLowerCase()!==String(cfg.ManagerEmail).toLowerCase() || !String(c.ManagerNote).trim() || !c.ManagerAlertAt) {
          c.Acknowledge=false;c.Error='Manager identity, action note and a manager alert are required.';
        } else { c.AcknowledgedAt=now;c.AcknowledgedBy=actor; }
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
  const recipient=String(stage==='MANAGER'?cfg.ManagerEmail:cfg.LeadershipEmail).trim();
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
    ensureCycles(now);
    records('Workboard').forEach(c=>{
      const priorStatus=c.Status;
      c.Status=statusFor(c,now);
      const stage=alertFor(c,now,Number(cfg.AckHours),Number(cfg.ResolveHours));
      if (stage) {
        try { deliver(c,stage,cfg,now); }
        catch(err) { c.Error='Alert failed: '+String(err);save('Workboard',c);return; }
        const log=records('EmailLog').find(r=>r.Key===c.CycleID+':'+stage);
        if (log && ['SENT','DRY_RUN'].includes(log.DeliveryStatus)) c[stage==='MANAGER'?'ManagerAlertAt':'LeadershipAlertAt']=log.SentAt||log.CreatedAt;
        else c.Error='Email delivery needs review in EmailLog.';
      }
      if (stage || priorStatus!==c.Status) save('Workboard',c);
    });
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
  [['H'+c._row+':I'+c._row,c.CompletedAt?[]:[String(c.EmployeeEmail)]],
    ['N'+c._row,c.AcknowledgedAt?[]:[String(cfg.ManagerEmail)]],['Q'+c._row,c.AcknowledgedAt?[]:[String(cfg.ManagerEmail)]]].forEach(([a,emails])=>{
    const description='ALLO:'+c.CycleID+':'+a;
    let pr=s.getProtections(SpreadsheetApp.ProtectionType.RANGE).find(p=>p.getDescription()===description);
    if (!pr) pr=s.getRange(a).protect().setDescription(description);
    restrict(pr,emails);
  });
  refreshInputExemptions();
}
function protectWorkbook() {
  book().getSheets().filter(s=>Object.keys(HEADERS).concat(['Manager','Health','Guide','RuleTests']).includes(s.getName())).forEach(s=>{
    let pr=s.getProtections(SpreadsheetApp.ProtectionType.SHEET).find(p=>p.getDescription()==='ALLO:system');
    if (!pr) pr=s.protect().setDescription('ALLO:system');
    restrict(pr,[]);
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
  });
  protection.setUnprotectedRanges(ranges);
}
function formatCycle(c) {
  const s=book().getSheetByName('Workboard');
  [9,14].forEach(col=>s.getRange(c._row,col).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build()));
  [6,11,13,16,18].forEach(col=>s.getRange(c._row,col).setNumberFormat('dd mmm yyyy hh:mm'));
  s.getRange(c._row,8).setNumberFormat('@');
}
function requireOwner() {
  const owner=PropertiesService.getScriptProperties().getProperty('AUTOMATION_OWNER');
  if (!owner || owner!==Session.getEffectiveUser().getEmail()) throw new Error('Run this action as the configured automation owner.');
}
