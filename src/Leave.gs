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
