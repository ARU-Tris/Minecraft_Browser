'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('craftsideToast',{
  onContent:listener=>ipcRenderer.on('craftside:toast-content',(_event,value)=>listener(value)),
  action:value=>{if(['open','close','enter','leave'].includes(value))ipcRenderer.send('craftside:toast-action',value);}
});
