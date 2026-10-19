'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{dialog,safeStorage,shell,clipboard}=require('electron');
const {create:createVault}=require('./password-vault.cjs'),{create:createTransfer}=require('./cookie-transfer.cjs');
function fillFields(record){
  if(location.origin!==record.origin)return 0;
  const visible=node=>{if(!node||node.disabled||node.readOnly)return false;const rect=node.getBoundingClientRect(),style=getComputedStyle(node);return rect.width>0&&rect.height>0&&style.visibility!=='hidden'&&Number(style.opacity)>0&&(!node.checkVisibility||node.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}));};
  const passwords=[...document.querySelectorAll('input[type="password"]:not([autocomplete="new-password"])')].filter(visible);
  if(passwords.length>1)return 0;const password=passwords[0],form=password?.form;
  if(form){try{if(new URL(form.action,location.href).origin!==location.origin)return 0;}catch{return 0;}}
  const root=form||document;
  let username=[...root.querySelectorAll('input[autocomplete="username"],input[type="email"]')].find(visible);
  if(!username&&password)username=[...root.querySelectorAll('input[type="text"],input:not([type])')].find(visible);
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;let filled=0;
  for(const [input,value] of [[username,record.username],[password,record.password]])if(input){setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));filled++;}
  return filled;
}
function create({root,profile,session,getWindow,getContents,getLanguage=()=> 'en',onState=()=>{}}){
  const vault=createVault(path.join(profile,'imported-data.enc'),safeStorage);
  const transfer=createTransfer({session,importBookmarks:values=>vault.importBookmarks(values),onState});
  async function importPasswordsFile(file){const stat=await fs.stat(file);if(!stat.isFile()||stat.size>16*1024*1024)throw Error('Choose a password CSV smaller than 16 MB.');const text=await fs.readFile(file,'utf8');return vault.importPasswords(text);}
  async function fill(id){
    const contents=getContents();if(!contents||contents.isDestroyed())throw Error('Open the matching website before filling this password.');
    let origin;try{origin=new URL(contents.getURL()).origin;}catch{throw Error('Open the matching website before filling this password.');}
    const record=await vault.credential(String(id),origin);
    let filled;try{filled=await contents.executeJavaScriptInIsolatedWorld(1201,[{code:`(${fillFields.toString()})(${JSON.stringify({origin:record.origin,username:record.username,password:record.password})})`}]);}catch{throw Error('Could not fill this login form.');}
    if(!filled)throw Error('No matching login fields were found.');return {filled};
  }
  async function helperFolder(open=true){
    const folder=path.join(profile,'Chrome Transfer Helper');await fs.mkdir(folder,{recursive:true});
    for(const name of ['manifest.json','background.js','transfer.html','transfer.css','transfer.js'])await fs.copyFile(path.join(root,'assets/chrome-transfer-helper',name),path.join(folder,name));
    await fs.copyFile(path.join(root,'design/locales.js'),path.join(folder,'locales.js'));
    if(open){const failure=await shell.openPath(folder);if(failure)throw Error('Could not open the Chrome helper folder.');}return {folder};
  }
  async function command(action,data={}){
    if(action==='info')return {...await vault.info(),transfer:transfer.state()};
    if(action==='list'){const contents=getContents();let origin='';try{origin=new URL(contents?.getURL()).origin;}catch{}return vault.list(data.kind==='passwords'?'passwords':'bookmarks',data.query,origin);}
    if(action==='passwordsImport'){const t=require('../design/i18n.js').create({getItem:getLanguage}).t;const result=await dialog.showOpenDialog(getWindow(),{title:t('Import Chrome passwords'),properties:['openFile'],filters:[{name:'Chrome password CSV',extensions:['csv']}]});if(result.canceled||!result.filePaths[0])return {cancelled:true};return importPasswordsFile(result.filePaths[0]);}
    if(action==='passwordFill')return fill(data.id);
    if(action==='helperFolder')return helperFolder();
    if(action==='cookiesStart')return transfer.start({replaceExisting:data.replaceExisting===true});
    if(action==='cookiesStop'){transfer.stop();return transfer.state();}
    if(action==='copyCode'){const state=transfer.state();if(state.status==='waiting')clipboard.writeText(state.code);return {};}
    throw Error('Unsupported import action.');
  }
  return {command,stop:()=>transfer.stop(),vault,transfer,importPasswordsFile,fill,helperFolder};
}
module.exports={create,fillFields};
