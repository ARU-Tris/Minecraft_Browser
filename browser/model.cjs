'use strict';
const HOME = 'craftside://inventory';
function webURL(input) {
  if (typeof input !== 'string' || input.length > 8192) return null;
  try {
    const url = new URL(input);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
function address(input) {
  const text = String(input || '').trim();
  if (!text || ['craftside://inventory', 'craftside://newtab'].includes(text)) return HOME;
  const url = webURL(text); if (url) return url;
  if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^[\w.-]+:\d+(\/|$)/.test(text)) throw Error('Only HTTP and HTTPS addresses are supported.');
  if (!/\s/.test(text) && /^(localhost|[\w\p{L}-]+(?:\.[\w\p{L}-]+)+)(:\d+)?(?:[/?#]|$)/u.test(text)) return webURL((/^localhost(?=[:/]|$)/.test(text) ? 'http://' : 'https://') + text);
  return 'https://www.google.com/search?q=' + encodeURIComponent(text);
}
class Tabs {
  constructor() { this.tabs = []; this.next = 1; this.left = this.add().id; this.right = null; this.focus = 'left'; this.ratio = 50; }
  add(url = HOME) { const tab = { id: this.next++, url, title: '', loading: false, error: '', back: false, forward: false }; this.tabs.push(tab); return tab; }
  get(id) { return this.tabs.find(tab => tab.id === Number(id)); }
  active() { return this.get(this[this.focus]); }
  select(id) { const tab = this.get(id); if (!tab) return; if (this.left === tab.id) this.focus = 'left'; else if (this.right === tab.id) this.focus = 'right'; else this[this.focus] = tab.id; }
  split(id, side = 'right') {
    const tab = this.get(id); if (!tab) return;
    const other = side === 'left' ? 'right' : 'left';
    if (this[other] === tab.id) this[other] = (this.get(this[side]) || this.tabs.find(item => item.id !== tab.id) || this.add()).id;
    else if (!this[other]) this[other] = (this.tabs.find(item => item.id !== tab.id) || this.add()).id;
    this[side] = tab.id; this.focus = side;
  }
  only(side = 'left') { const tab = this.get(this[side]); if (tab) { this.left = tab.id; this.right = null; this.focus = 'left'; } }
  toggle() { if (this.right) this.only(); else this.split((this.tabs.find(tab => tab.id !== this.active().id) || this.add()).id); }
  close(id) {
    const tab = this.get(id); if (!tab) return;
    const side = this.left === tab.id ? 'left' : this.right === tab.id ? 'right' : null;
    this.tabs.splice(this.tabs.indexOf(tab), 1);
    if (!this.tabs.length) { this.left = this.add().id; this.right = null; }
    else if (side && this.right) { this.left = this[side === 'left' ? 'right' : 'left']; this.right = null; }
    else if (side) this.left = this.tabs[0].id;
    if (!this.right) this.focus = 'left';
  }
  snapshot() { return { tabs: this.tabs.map(tab => ({ ...tab })), panes: { left: this.left, right: this.right }, focus: this.focus, ratio: this.ratio }; }
}
function bounds(input, size) {
  if (!input || !['x','y','width','height'].every(key => Number.isFinite(input[key]))) return null;
  const x = Math.max(0, Math.min(size[0], Math.round(input.x))), y = Math.max(0, Math.min(size[1], Math.round(input.y)));
  return { x, y, width: Math.max(0, Math.min(size[0] - x, Math.round(input.width))), height: Math.max(0, Math.min(size[1] - y, Math.round(input.height))) };
}
module.exports = { HOME, webURL, address, Tabs, bounds };
