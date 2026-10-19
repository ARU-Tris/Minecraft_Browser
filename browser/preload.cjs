'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const listen = (channel, listener) => { const callback = (_event, value) => listener(value); ipcRenderer.on(channel, callback); return () => ipcRenderer.removeListener(channel, callback); };
contextBridge.exposeInMainWorld('craftsideBrowser', {
  version: '0.2.0',
  command: (action, data = {}) => ipcRenderer.invoke('craftside:command', action, data),
  layout: data => ipcRenderer.send('craftside:layout', data),
  onState: listener => listen('craftside:state', listener),
  onShortcut: listener => listen('craftside:shortcut', listener),
  onToastAction: listener => listen('craftside:toast-action', listener),
  onPreview: listener => listen('craftside:preview', listener)
});
contextBridge.exposeInMainWorld('craftsideNotifications', {
  getGmailUnread: () => ipcRenderer.invoke('craftside:gmail'),
  onGmailUnread: listener => listen('craftside:gmail', listener)
});
contextBridge.exposeInMainWorld('craftsideMigration',{
  invoke:(action,data={})=>ipcRenderer.invoke('craftside:migration',action,data),
  onState:listener=>listen('craftside:migration-state',listener)
});
