let gaurangBusy=false;
function toggleGaurang(){
  const panel=document.getElementById('gaurang-chat'),open=panel.hidden;
  panel.hidden=!open;document.getElementById('gaurang-launch').setAttribute?.('aria-expanded',String(open));
  if(open)document.getElementById('gaurang-question').focus?.();else document.getElementById('gaurang-launch').focus?.();
}
function gaurangMessage(text,user,answer){
  const log=document.getElementById('gaurang-messages'),bubble=document.createElement('div');
  bubble.className='gaurang-bubble'+(user?' user':'');bubble.textContent=text;
  if(answer){const source=document.createElement('small');source.textContent=(answer.mode==='live'?'Google Sheets':'Website demo')+' · as of '+answer.asOf+'\nSources: '+answer.sources.join('; ');bubble.appendChild(source);}
  log.appendChild(bubble);while(log.children.length>40)log.removeChild(log.firstChild);log.scrollTop=log.scrollHeight;
}
function askGaurangChat(preset){
  if(gaurangBusy)return;
  const input=document.getElementById('gaurang-question'),question=String(preset||input.value).trim();
  const status=document.getElementById('gaurang-status'),send=document.getElementById('gaurang-send');
  if(!question||question.length>1000){status.textContent='Enter a question between 1 and 1,000 characters.';return;}
  gaurangBusy=true;send.disabled=true;status.textContent='Checking the available records…';gaurangMessage(question,true);input.value='';
  const done=()=>{gaurangBusy=false;send.disabled=false;input.focus?.();};
  const success=answer=>{gaurangMessage(answer.answer,false,answer);status.textContent='Answered from records. Ask another question with its task or employee name.';done();};
  const failure=error=>{status.textContent=String(error.message||'Unable to read records. Try again.');done();};
  if(typeof google!=='undefined'&&google.script&&google.script.run){google.script.run.withSuccessHandler(success).withFailureHandler(failure).askGaurang(question);}
  else {try{success(gaurangAnswer(question,{now,settings:settingsState,tasks,cycles,history:recoveryHistory,leaveRequests:JSON.parse(localStorage.getItem('allo-leave-v1')||'[]'),mode:'demo'}));}catch(e){failure(e);}}
}
if(typeof google!=='undefined'&&google.script&&google.script.run){document.getElementById('gaurang-mode').textContent='Google Sheets · fresh read on each question';document.getElementById('gaurang-chat').hidden=false;}
if(typeof document.addEventListener==='function')document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.getElementById('gaurang-chat').hidden&&!document.body.classList.contains('gaurang-sidebar')){document.getElementById('gaurang-chat').hidden=true;document.getElementById('gaurang-launch').setAttribute('aria-expanded','false');document.getElementById('gaurang-launch').focus();}});
