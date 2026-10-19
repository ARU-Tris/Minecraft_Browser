(() => {
  'use strict';const bridge=window.craftsideMigration;if(!bridge)return;
  const $=selector=>document.querySelector(selector),t=(source,values)=>window.CraftI18n.t(source,values),dialog=$('#migration-dialog'),library=$('#migration-library-dialog');
  let state={status:'idle'},kind='passwords',returnSettings=false,returnImport=false,searchTimer,busy=false;
  for(const id of ['settings-import-chrome','passwords-button','chrome-bookmarks-button'])$('#'+id).hidden=false;
  function error(value){$('#migration-error').textContent=value?t(value):'';$('#migration-error').hidden=!value;}
  function open(target){document.querySelectorAll('dialog[open]').forEach(item=>{if(item!==target)item.close();});if(!target.open)target.showModal();}
  async function info(){try{const data=await bridge.invoke('info');$('#migration-counts').textContent=t('{passwords} saved passwords · {bookmarks} Chrome bookmarks',data);update(data.transfer);}catch(failure){error(failure.message);}}
  function update(value){state=value||{status:'idle'};const waiting=state.status==='waiting';busy=state.status==='transferring';$('#transfer-code-row').hidden=!waiting;$('#transfer-code').value=waiting?state.code:'';$('#start-chrome-transfer').disabled=busy;$('#stop-chrome-transfer').hidden=!waiting;$('#close-migration').disabled=busy;
    $('#migration-transfer-status').textContent=t({idle:'No transfer is running.',waiting:'Waiting for Chrome. This code expires in 10 minutes.',transferring:'Transferring…',completed:'Transfer complete.',cancelled:'Transfer cancelled.',expired:'The code expired. Start a new transfer.',failed:'Transfer did not finish. Imported entries may already be available.'}[state.status]||'No transfer is running.');
    if(state.result)$('#migration-transfer-status').textContent+=' '+t('Imported {imported} cookies and {bookmarks} bookmarks. Kept {existing} existing cookies; skipped {skipped}.',{...state.result,skipped:state.result.expired+state.result.partitioned+state.result.invalid+state.result.failed});
  }
  async function invoke(action,data){error('');try{return await bridge.invoke(action,data);}catch(failure){error(failure.message);return null;}}
  $('#settings-import-chrome').onclick=()=>{returnSettings=true;open(dialog);error('');info();};
  $('#close-migration').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{if(state.status==='waiting')bridge.invoke('cookiesStop');if(returnSettings&&!document.querySelector('dialog[open]')){returnSettings=false;$('#settings-dialog').showModal();}});
  $('#import-password-csv').onclick=async()=>{const result=await invoke('passwordsImport');if(result&&!result.cancelled){$('#migration-password-status').textContent=t('Imported {added} passwords. Kept or skipped {skipped}.',result);info();}};
  $('#open-chrome-helper').onclick=()=>invoke('helperFolder');
  $('#start-chrome-transfer').onclick=async()=>{const result=await invoke('cookiesStart',{replaceExisting:$('#replace-chrome-cookies').checked});if(result)update(result);};
  $('#stop-chrome-transfer').onclick=async()=>{const result=await invoke('cookiesStop');if(result)update(result);};$('#copy-transfer-code').onclick=()=>invoke('copyCode');
  bridge.onState(value=>{update(value);if(value.status==='completed')info();});
  async function showLibrary(next,fromImport=false){kind=next;returnImport=fromImport;open(library);$('#migration-library-query').value='';await renderLibrary();}
  async function renderLibrary(){
    $('#migration-library-error').hidden=true;try{const data=await bridge.invoke('list',{kind,query:$('#migration-library-query').value}),rows=$('#migration-library-rows');$('#migration-library-title').textContent=t(kind==='passwords'?'Saved passwords':'Chrome bookmarks');$('#migration-library-count').textContent=t('Showing {shown} of {total}',{shown:data.entries.length,total:data.matches});rows.replaceChildren();
      for(const entry of data.entries){const row=document.createElement('article');row.className='migration-record';const text=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('small');text.dataset.userContent='';title.textContent=entry.origin||entry.title;detail.textContent=kind==='passwords'?entry.username:entry.folder;text.append(title,detail);row.append(text);
        const visit=document.createElement('button');visit.className='minecraft-button';visit.textContent=t('Open site');visit.onclick=()=>{returnImport=returnSettings=false;library.close();document.dispatchEvent(new CustomEvent('craftside:open-bookmark',{detail:{title:entry.name||entry.title,url:entry.origin||entry.url}}));};row.append(visit);
        if(kind==='passwords'){const fill=document.createElement('button');fill.className='minecraft-button';fill.textContent=t('Fill login');fill.disabled=!entry.canFill;fill.onclick=async()=>{try{await bridge.invoke('passwordFill',{id:entry.id});returnImport=returnSettings=false;library.close();}catch(failure){$('#migration-library-error').textContent=t(failure.message);$('#migration-library-error').hidden=false;}};row.append(fill);}rows.append(row);
      }
      if(!data.entries.length){const empty=document.createElement('p');empty.textContent=t('No imported entries found.');rows.append(empty);}
    }catch(failure){$('#migration-library-error').textContent=t(failure.message);$('#migration-library-error').hidden=false;}
  }
  $('#passwords-button').onclick=()=>showLibrary('passwords');$('#chrome-bookmarks-button').onclick=()=>showLibrary('bookmarks');
  $('#view-imported-passwords').onclick=()=>showLibrary('passwords',true);$('#view-chrome-bookmarks').onclick=()=>showLibrary('bookmarks',true);
  $('#close-migration-library').onclick=()=>library.close();library.addEventListener('close',()=>{if(returnImport&&!document.querySelector('dialog[open]')){returnImport=false;open(dialog);info();}});
  $('#migration-library-query').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(renderLibrary,150);});
  document.addEventListener('craftside:language-changed',()=>{update(state);if(dialog.open)info();if(library.open)renderLibrary();});
  // Decrypt the imported vault only when its manager or library is opened.
})();
