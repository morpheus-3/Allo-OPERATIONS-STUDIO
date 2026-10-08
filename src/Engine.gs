/* Pure rules shared by Apps Script and the automated tests. All dates use the
   configured project timezone (Asia/Kolkata). Intervals are calendar days. */
function dayKey(d) {
  return Utilities.formatDate(new Date(d), 'Asia/Kolkata', 'yyyy-MM-dd');
}
function dateAt(day, hour) { return new Date(day + 'T' + String(hour).padStart(2, '0') + ':00:00+05:30'); }
function addDays(day, days) {
  return dayKey(new Date(dateAt(day, 12).getTime() + days * 86400000));
}
function workingDay(day) { return ![0, 6].includes(new Date(dateAt(day, 12).getTime() + 19800000).getUTCDay()); }
function firstDay(day, daily) {
  while (daily && !workingDay(day)) day = addDays(day, 1);
  return day;
}
function nextDue(task, completedAt) {
  // Completion-anchored intervals; daily work resumes on the next working day.
  return dateAt(firstDay(addDays(dayKey(completedAt), Number(task.IntervalDays)), task.ProofType === 'DAILY'), Number(task.DueHour));
}
function cycleFor(task, due) {
  return { CycleID: task.TaskID + ':' + dayKey(due), TaskID: task.TaskID,
    Task: task.Task, Employee: task.Employee, EmployeeEmail: String(task.EmployeeEmail).trim().toLowerCase(),
    DueAt: due, ProofType: task.ProofType, Proof: '', Complete: false,
    CompletedBy: '', CompletedAt: '', Status: 'Upcoming',
    ManagerAlertAt: '', Acknowledge: false, AcknowledgedBy: '', AcknowledgedAt: '',
    ManagerNote: '', LeadershipAlertAt: '', Error: '' };
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
  if (!['true','false'].includes(String(cfg.DryRun).toLowerCase())) throw new Error('DryRun must be TRUE or FALSE; invalid values never enable sending.');
  if (!Number.isFinite(Number(cfg.AckHours)) || !Number.isFinite(Number(cfg.ResolveHours)) || !(Number(cfg.AckHours)>0) || !(Number(cfg.ResolveHours)>=Number(cfg.AckHours))) throw new Error('SLA must use finite positive hours; ResolveHours must be at least AckHours.');
  if (!validEmail(cfg.ManagerEmail) || !validEmail(cfg.LeadershipEmail)) throw new Error('Valid manager and leadership email addresses required.');
  if (String(cfg.DryRun).toLowerCase()==='false' && [cfg.ManagerEmail,cfg.LeadershipEmail].some(isSampleEmail)) throw new Error('Replace sample recipients before enabling live email.');
}
