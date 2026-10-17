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
