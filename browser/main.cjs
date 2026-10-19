'use strict';
const { app, BrowserWindow, WebContentsView, ipcMain, protocol, session, net, shell, dialog, Menu } = require('electron');
const fs = require('node:fs'), path = require('node:path'), { pathToFileURL } = require('node:url');
const { HOME, webURL, address, Tabs, bounds } = require('./model.cjs');
const { watchGmailSession } = require('./gmail-session.cjs');
const ROOT = path.resolve(__dirname, '..'), UI = 'craftside-app://app/design/index.html';
const smoke = process.argv.includes('--smoke');
const argument = prefix => process.argv.find(value => value.startsWith(prefix + '='))?.slice(prefix.length+1);
app.setName('MINECRAFT?');
app.setPath('userData', argument('--profile') || path.join(app.getPath('appData'), 'MinecraftBrowser'));
protocol.registerSchemesAsPrivileged([{ scheme: 'craftside-app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
const single = smoke || app.requestSingleInstanceLock();
if (!single) app.quit();
let win, migration, toastWindow, toastCloseTimer, browserSession, blocker, blockerEnabled = false, adMode = 'collapse', uiLanguage = 'en', layout = {}, gmail = { status: 'unavailable' }, downloads = [];
const tabs = new Tabs(), views = new Map(), watchers = new Map();
const send = (channel, value) => { if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(channel, value); };
const snapshot = () => ({ ...tabs.snapshot(), downloads: downloads.map(({ item, ...rest }) => rest), adMode, blocking: blockerEnabled });
function publish() { send('craftside:state', snapshot()); }
function trusted(event) { return win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && event.senderFrame.url === UI; }
function owned(tab) { return tab && views.get(tab.id)?.webContents; }
function showViews() {
  if (!win || win.isDestroyed()) return;
  const size = win.getContentSize();
  for (const [id, view] of views) {
    const tab = tabs.get(id), side = tabs.left === id ? 'left' : tabs.right === id ? 'right' : null;
    const box = side && bounds(layout[side], size);
    const visible = Boolean(tab && tab.url !== HOME && !tab.error && side && box?.width > 1 && box?.height > 1 && !layout.overlay);
    if (visible) { const old=view.getBounds();if(['x','y','width','height'].some(key=>old[key]!==box[key]))view.setBounds(box);if(!view.getVisible())view.setVisible(true); }
    else {
      if (view.getVisible() && layout.overlay && !view.webContents.isDestroyed()) view.webContents.capturePage().then(image => send('craftside:preview', { id, image: image.toDataURL() })).catch(() => {});
      if(view.getVisible())view.setVisible(false);
    }
  }
}
function update(tab) {
  const wc = owned(tab); if (!wc || wc.isDestroyed()) return;
  const url = wc.getURL();
  if (url === 'about:blank') { tab.url = HOME; tab.title = ''; }
  else if (webURL(url)) { tab.url = url; tab.title = wc.getTitle().slice(0,300); }
  tab.back = wc.navigationHistory.canGoBack(); tab.forward = wc.navigationHistory.canGoForward(); tab.loading = wc.isLoading();
  publish(); showViews();
}
function shortcut(contents, event, input) {
  if (input.type !== 'keyDown') return;
  const ctrl = input.control || input.meta, key = input.key.toLowerCase();
  let action;
  if (ctrl && !input.alt && ['l','t','w','b','r'].includes(key)) action = key;
  else if (input.key === 'F5') action = 'r';
  else if (input.key === 'F11') { event.preventDefault(); win.setFullScreen(!win.isFullScreen()); return; }
  else if (input.alt && input.key === 'ArrowLeft') action = 'back';
  else if (input.alt && input.key === 'ArrowRight') action = 'forward';
  if (!action) return;
  event.preventDefault();
  if (action === 't') { const tab = tabs.add(); tabs.select(tab.id); publish(); showViews(); }
  else if (action === 'w') close(tabs.active().id);
  else if (action === 'r' || action === 'back' || action === 'forward') control(action === 'r' ? 'reload' : action);
  else { win.webContents.focus(); send('craftside:shortcut', action); }
}
function contextMenu(wc) {
  wc.on('context-menu', (_event, params) => {
    const language=require('../design/i18n.js').create({getItem:()=>uiLanguage});
    const label=text=>language.t(text);
    const template = [];
    if (webURL(params.linkURL)) template.push({ label: label('Open link in new tab'), click: () => openURL(params.linkURL, true) }, { type: 'separator' });
    if (params.isEditable) template.push({ role: 'undo',label:label('Undo') }, { role: 'redo',label:label('Redo') }, { type: 'separator' }, { role: 'cut',label:label('Cut') }, { role: 'copy',label:label('Copy') }, { role: 'paste',label:label('Paste') }, { role: 'selectAll',label:label('Select all') });
    else if (params.selectionText) template.push({ role: 'copy',label:label('Copy') });
    template.push({ type: 'separator' }, { label: label('Back'), enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() }, { label: label('Reload'), click: () => wc.reload() });
    Menu.buildFromTemplate(template).popup({ window: win });
  });
}
async function createView(tab) {
  if (views.has(tab.id)) return views.get(tab.id);
  const view = new WebContentsView({ webPreferences: { session: browserSession, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, backgroundThrottling: true } });
  views.set(tab.id, view); win.contentView.addChildView(view); view.setVisible(false);
  const wc = view.webContents;
  wc.setWindowOpenHandler(details => {
    if (webURL(details.url)) { openURL(details.url, true); }
    return { action: 'deny' };
  });
  for (const event of ['will-navigate','will-redirect']) wc.on(event, (e, url) => { if (url !== 'about:blank' && !webURL(url)) e.preventDefault(); });
  wc.on('will-attach-webview', event => event.preventDefault());
  wc.on('content-bounds-updated', event => event.preventDefault());
  wc.on('before-input-event', (event, input) => shortcut(wc, event, input));
  wc.on('focus', () => { if (tabs.left === tab.id) tabs.focus = 'left'; else if (tabs.right === tab.id) tabs.focus = 'right'; publish(); });
  wc.on('did-start-navigation', (_event, _url, _inPlace, isMain) => { if (isMain) { tab.error = ''; tab.loading = true; publish(); } });
  for (const event of ['did-navigate','did-navigate-in-page','did-stop-loading','page-title-updated']) wc.on(event, () => update(tab));
  wc.on('did-fail-load', (_event, code, description, url, isMain) => {
    if (!isMain || code === -3) return;
    tab.url = webURL(url) || tab.url; tab.error = description; tab.loading = false; update(tab);
  });
  wc.on('render-process-gone', () => { tab.error = 'Page process stopped. Reload to try again.'; tab.loading = false; publish(); showViews(); });
  contextMenu(wc);
  watchers.set(tab.id, watchGmailSession(wc, state => {
    // Only a Gmail tab (or its sign-in redirect) owns the mail indicator.
    let host; try { host = new URL(wc.getURL()).hostname; } catch { return; }
    if (['mail.google.com','accounts.google.com'].includes(host) || state.status === 'unavailable' && gmail.owner === tab.id) {
      gmail = { ...state, owner: tab.id }; send('craftside:gmail', state);
    }
  }));
  await wc.loadURL('about:blank');
  return view;
}
async function openURL(input, newTab = false) {
  const url = address(input), tab = newTab ? tabs.add() : tabs.active();
  tabs.select(tab.id); tab.error = '';
  if (url === HOME) {
    if (owned(tab)) await owned(tab).loadURL('about:blank');
    tab.url = HOME; tab.title = ''; publish(); showViews(); return snapshot();
  }
  tab.url = url; tab.loading = true; publish();
  const view = await createView(tab);
  if (!tabs.get(tab.id) || view.webContents.isDestroyed()) return snapshot();
  // Starting the load is asynchronous; the state events update both chrome and pane.
  tab.url = url;
  view.webContents.loadURL(url).catch(() => {}); publish(); showViews(); return snapshot();
}
function close(id) {
  const tab = tabs.get(id); if (!tab) return;
  watchers.get(tab.id)?.stop(); watchers.delete(tab.id);
  const view = views.get(tab.id); if (view) { win.contentView.removeChildView(view); if (!view.webContents.isDestroyed()) view.webContents.close(); views.delete(tab.id); }
  if (gmail.owner === tab.id) { gmail = { status: 'unavailable' }; send('craftside:gmail', gmail); }
  tabs.close(id); publish(); showViews();
}
function control(action) {
  const tab = tabs.active(), wc = owned(tab); if (!wc || wc.isDestroyed()) return;
  tab.error = '';
  if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  if (action === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
  if (action === 'reload') wc.reload();
  publish(); showViews();
}
function toastPosition() {
  if (!toastWindow || toastWindow.isDestroyed() || !win) return;
  const {x,y,width}=win.getContentBounds();toastWindow.setPosition(x+width-352,y+32);
}
async function advancement(data) {
  clearTimeout(toastCloseTimer);
  if(data.hide){if(toastWindow&&!toastWindow.isDestroyed()){const old=toastWindow;old.webContents.send('craftside:toast-content',{hide:true});toastCloseTimer=setTimeout(()=>{if(!old.isDestroyed())old.close();},650);}return;}
  if(!toastWindow||toastWindow.isDestroyed()){
    const current=new BrowserWindow({parent:win,width:344,height:84,show:false,frame:false,transparent:true,resizable:false,skipTaskbar:true,focusable:false,hasShadow:false,webPreferences:{session:win.webContents.session,preload:path.join(__dirname,'toast-preload.cjs'),sandbox:true,nodeIntegration:false,contextIsolation:true}});
    toastWindow=current;current.on('closed',()=>{if(toastWindow===current)toastWindow=null;});
    current.webContents.setWindowOpenHandler(()=>({action:'deny'}));current.webContents.on('will-navigate',event=>event.preventDefault());
    await current.loadURL('craftside-app://app/design/notification.html');
  }
  if(!toastWindow||toastWindow.isDestroyed())return;
  const safeImage=value=>typeof value==='string' && /^(?:blob:craftside-app:\/\/app\/|craftside-app:\/\/app\/assets\/)/.test(value) ? value : '';
  const background=String(data.background||'').match(/^url\(["']?([^"')]+)["']?\)$/)?.[1];
  toastWindow.webContents.send('craftside:toast-content',{title:String(data.title||'').slice(0,300),heading:String(data.heading||'').slice(0,80),background:safeImage(background)?`url("${safeImage(background)}")`:'',icon:safeImage(data.icon)});
  toastPosition();toastWindow.showInactive();
}
async function command(action, data = {}) {
  if (action === 'state') return snapshot();
  if (action === 'language') { uiLanguage=data.language==='ko'?'ko':'en'; return; }
  if (action === 'navigate') return openURL(data.url, Boolean(data.newTab));
  if (action === 'advancement') { await advancement(data); return; }
  if (action === 'new') { const tab = tabs.add(); tabs.select(tab.id); }
  else if (action === 'select') tabs.select(data.id);
  else if (action === 'close') close(data.id);
  else if (action === 'split') tabs.split(data.id, data.side === 'left' ? 'left' : 'right');
  else if (action === 'toggleSplit') tabs.toggle();
  else if (action === 'only') tabs.only(data.side === 'right' ? 'right' : 'left');
  else if (action === 'focus' && tabs[data.side]) tabs.focus = data.side === 'right' ? 'right' : 'left';
  else if (action === 'ratio') tabs.ratio = Math.max(28, Math.min(72, Math.round(Number(data.value) || 50)));
  else if (['back','forward','reload'].includes(action)) control(action);
  else if (action === 'ad' && ['collapse','original'].includes(data.mode)) {
    adMode = data.mode;
    if (blocker) {
      if (adMode === 'original' && blockerEnabled) blocker.disableBlockingInSession(browserSession);
      if (adMode !== 'original' && !blockerEnabled) blocker.enableBlockingInSession(browserSession);
      blockerEnabled = adMode !== 'original';
    }
    fs.writeFileSync(path.join(app.getPath('userData'), 'browser-settings.json'), JSON.stringify({ adMode }));
  }
  else if (action === 'downloadFolder') shell.openPath(app.getPath('downloads'));
  else if (action === 'downloadShow') { const download = downloads.find(item => item.id === data.id); if (download?.state === 'completed') shell.showItemInFolder(download.path); }
  publish(); showViews(); return snapshot();
}
async function installProtocol(uiSession) {
  const news = require('./news.cjs').create(net.fetch);
  uiSession.protocol.handle('craftside-app', async request => {
    const url = new URL(request.url);
    if (url.host !== 'app') return new Response('', { status: 403 });
    if (url.pathname === '/api/minecraft-news') {
      try { return Response.json(await news(), { headers: { 'Cache-Control': 'no-store' } }); }
      catch { return Response.json({ error: 'News unavailable', articles: [] }, { status: 503 }); }
    }
    let name; try { name = decodeURIComponent(url.pathname); } catch { return new Response('', { status: 400 }); }
    if (!/^\/(assets\/|design\/[^/]+\.(?:html|js|css)$)/.test(name) || /[\\\x00]|(?:^|\/)\.\.(?:\/|$)/.test(name)) return new Response('', { status: 403 });
    const file = path.resolve(ROOT, '.' + name);
    if (!file.startsWith(ROOT + path.sep)) return new Response('', { status: 403 });
    try {
      const response = await net.fetch(pathToFileURL(file).href);
      const headers = new Headers(response.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'");
      return new Response(response.body, { status: response.status, headers });
    } catch { return new Response('', { status: 404 }); }
  });
}
async function permissions() {
  const granted=new Set();
  browserSession.setPermissionRequestHandler(async (wc, permission, callback, details) => {
    const tab = [...views].find(([,view]) => view.webContents === wc)?.[0];
    let url; try { url = new URL(details.requestingUrl || wc.getURL()); } catch { callback(false); return; }
    if (tab !== tabs.active().id || !webURL(url.href) || !['media','geolocation','notifications','clipboard-read','fullscreen','pointerLock'].includes(permission)) { callback(false); return; }
    if (permission === 'fullscreen') { callback(true); return; }
    const language=require('../design/i18n.js').create({getItem:()=>uiLanguage});
    const result = await dialog.showMessageBox(win, { type: 'question', title: 'MINECRAFT?', message: language.t('Allow {permission} for {site}?',{permission,site:url.origin}), buttons: [language.t('Deny'),language.t('Allow')], defaultId: 0, cancelId: 0 });
    if(result.response===1)granted.add(url.origin+'|'+permission);
    callback(result.response === 1);
  });
  browserSession.setPermissionCheckHandler((_wc,permission,origin)=>granted.has(origin+'|'+permission));
}
async function start() {
  Menu.setApplicationMenu(null);
  browserSession = session.fromPartition('persist:craftside-web');
  const uiSession = session.fromPartition('persist:craftside-ui');
  uiSession.setPermissionRequestHandler((_wc,_permission,callback) => callback(false));
  await installProtocol(uiSession); await permissions();
  try { const settings = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'browser-settings.json'))); if (settings.adMode === 'original') adMode = 'original'; } catch { /* New profiles block ads by default. */ }
  try {
    const { ElectronBlocker } = require('@ghostery/adblocker-electron');
    blocker = ElectronBlocker.deserialize(fs.readFileSync(path.join(ROOT, 'assets', 'filters', 'engine.bin')));
    if (adMode !== 'original') { blocker.enableBlockingInSession(browserSession); blockerEnabled = true; }
  } catch (error) { console.error('Ad filter unavailable:', error.message); }
  win = new BrowserWindow({ width: 1420, height: 960, minWidth: 860, minHeight: 680, title: 'MINECRAFT?', icon: path.join(ROOT,'assets','browser.ico'), backgroundColor: '#343630', show: false, titleBarStyle: 'hidden', titleBarOverlay: { color: '#343630', symbolColor: '#eeeeee', height: 30 }, webPreferences: { preload: path.join(__dirname,'preload.cjs'), session: uiSession, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
  win.webContents.setWindowOpenHandler(({url}) => { if (webURL(url)) openURL(url,true); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (event,url) => { if (url !== UI) { event.preventDefault(); if (webURL(url)) openURL(url,true); } });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.on('before-input-event', (event,input) => shortcut(win.webContents,event,input));
  win.webContents.on('render-process-gone', () => { if (!win.isDestroyed()) win.reload(); });
  win.on('resize', () => send('craftside:shortcut','resize'));
  win.on('move',toastPosition);win.on('resize',toastPosition);
  win.on('app-command', (_event,action) => { if (action === 'browser-backward') control('back'); if (action === 'browser-forward') control('forward'); });
  win.once('ready-to-show', () => { win.show(); if (!smoke) win.maximize(); });
  win.on('closed', () => { migration?.stop();for (const watcher of watchers.values()) watcher.stop(); watchers.clear(); for (const view of views.values()) if (!view.webContents.isDestroyed()) view.webContents.close(); views.clear(); win = null; });
  browserSession.on('will-download', (_event,item) => {
    const download = { id: Date.now() + '-' + downloads.length, name: item.getFilename(), path: '', state: 'progressing', received: 0, total: item.getTotalBytes(), item };
    downloads.unshift(download); downloads = downloads.slice(0,100); publish();
    item.on('updated', (_event,state) => { download.state = state; download.received = item.getReceivedBytes(); publish(); });
    item.once('done', (_event,state) => { download.state = state; download.path = item.getSavePath(); download.received = item.getReceivedBytes(); publish(); });
  });
  ipcMain.handle('craftside:command', (event,action,data) => { if (!trusted(event)) throw Error('Untrusted sender'); return command(action,data && typeof data === 'object' ? data : {}); });
  ipcMain.handle('craftside:gmail', event => { if (!trusted(event)) throw Error('Untrusted sender'); return gmail; });
  migration=require('./migration.cjs').create({root:ROOT,profile:app.getPath('userData'),session:browserSession,getWindow:()=>win,getContents:()=>owned(tabs.active()),getLanguage:()=>uiLanguage,onState:value=>send('craftside:migration-state',value)});
  ipcMain.handle('craftside:migration',(event,action,data)=>{if(!trusted(event))throw Error('Untrusted sender');return migration.command(action,data&&typeof data==='object'?data:{});});
  ipcMain.on('craftside:toast-action',(event,action)=>{if(toastWindow&&!toastWindow.isDestroyed()&&event.sender===toastWindow.webContents&&event.senderFrame===toastWindow.webContents.mainFrame&&['open','close','enter','leave'].includes(action))send('craftside:toast-action',action);});
  ipcMain.on('craftside:layout', (event,value) => { if (trusted(event) && value && typeof value === 'object') { layout = { left: value.left, right: value.right, overlay: Boolean(value.overlay) }; showViews(); } });
  await win.loadURL(UI);
  if (smoke) {
    try { const suites={navigation:'./navigation-smoke.cjs',performance:'./performance-smoke.cjs',experience:'./experience-smoke.cjs'};await require(suites[argument('--smoke-suite')]||'./smoke.cjs').run({ win, tabs, views, command, snapshot, browserSession, blocker, migration, app, output: argument('--smoke-output') }); app.exit(0); }
    catch (error) { console.error(error.stack); app.exit(1); }
  }
}
if (single) app.whenReady().then(start).catch(error => { console.error(error.stack); dialog.showErrorBox('MINECRAFT?', error.message); app.exit(1); });
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
