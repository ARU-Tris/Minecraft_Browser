'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Model = require('../design/unread-model.js');
const I18n = require('../design/i18n.js');
const code = fs.readFileSync(require.resolve('../design/unread.js'), 'utf8');
class Target {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(listener); }
  dispatchEvent(event) { for (const listener of this.listeners.get(event.type) || []) listener(event); }
}
class Element extends Target {
  constructor(className = '') { super(); this.dataset = {}; this.className = className; this.children = []; this.attrs = {}; this.hidden = false; this.textContent = ''; this.style = { setProperty: (key, value) => { this.attrs[key] = value; },getPropertyValue:key=>this.attrs[key]||'' }; }
  setAttribute(key, value) { this.attrs[key] = value; }
  getAttribute(key) { return this.attrs[key]??null; }
  append(child) { child.parent = this; this.children.push(child); }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
  querySelector(selector) { return selector === 'img' ? this.image : this.children.find(child => child.className === selector.slice(1)) || null; }
  close() { this.open = false; }
}
function setup(native = false) {
  const nodes = new Map(), document = new Target(), window = new Target(), storage = new Map(), writes = [], timers = new Map(); let timer = 0, callback, resolveInitial;
  const localStorage = { getItem(key) { return storage.get(key) ?? null; }, setItem(key, raw) { storage.set(key, raw); writes.push(key); } };
  for (const id of ['unread-news-status', 'gmail-session-status', 'gmail-session-help', 'unread-save-error', 'preview-enchantment', 'unread-preview-note', 'end-enchantment-preview', 'open-gmail-session', 'news-toast-link', 'news-toast', 'settings-dialog']) nodes.set('#' + id, new Element());
  function card(kind, src) { const node = new Element(); node.dataset = { notificationKind: kind, notificationLabel: kind }; node.image = { src }; return node; }
  const news = card('news', 'water_bucket.png'), gmail = card('gmail', 'writable_book.png'), cards = [news, gmail];
  document.querySelector = selector => { assert(nodes.has(selector), selector); return nodes.get(selector); };
  document.querySelectorAll = selector => { assert.equal(selector, '[data-notification-kind]'); return cards; };
  document.createElement = () => new Element();
  window.CraftUnreadModel = Model; window.CraftI18n = I18n.create(localStorage);
  if (native) window.craftsideNotifications = {
    onGmailUnread(listener) { callback = listener; },
    getGmailUnread() { return new Promise(resolve => { resolveInitial = resolve; }); }
  };
  class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } }
  vm.runInNewContext(code, { document, window, localStorage, CustomEvent, Promise, setTimeout(fn, delay) { timers.set(++timer, { fn, delay }); return timer; }, clearTimeout(id) { timers.delete(id); } });
  const send = (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail }));
  const click = id => nodes.get('#' + id).dispatchEvent(new CustomEvent('click'));
  return { nodes, window, storage, writes, news, gmail, cards, timers, send, click, pushGmail: value => callback(value), resolveInitial: value => resolveInitial(value) };
}
const article = slug => ({ title: slug, url: 'https://www.minecraft.net/en-us/article/' + slug, published: 100 });
const glint = card => Boolean(card.querySelector('.item-enchantment'));
const checks = [];
const check = async (name, fn) => { await fn(); checks.push({ name, passed: true }); };
(async () => {
  await check('Preview without native engine never claims a connected Gmail session', () => {
    const test = setup(); assert.match(test.nodes.get('#gmail-session-status').textContent, /not connected/); assert.equal(glint(test.gmail), false); assert.equal(glint(test.news), false); assert.equal(test.writes.length, 0);
  });
  await check('New news lights the icon; dismissing its toast never acknowledges it', () => {
    const test = setup(); test.send('craftside:news-received', { articles: [article('one')] }); assert.equal(glint(test.news), true);
    test.nodes.get('#news-toast').hidden = true; assert.equal(glint(test.news), true); assert.match(test.news.attrs['aria-label'], /1 unread news articles/);
  });
  await check('Real article clicks acknowledge one, and the news bookmark acknowledges the remainder', () => {
    const test = setup(); test.send('craftside:news-received', { articles: [article('one'), article('two')] });
    test.nodes.get('#news-toast-link').href = article('one').url; test.click('news-toast-link'); assert.match(test.news.attrs['aria-label'], /1 unread/);
    test.send('craftside:open-bookmark', { url: 'https://www.minecraft.net/en-us/article' }); assert.equal(glint(test.news), false); assert.equal(JSON.parse(test.storage.get(Model.key)).news.length, 0);
  });
  await check('A news toast preview never clears genuine unread state', () => {
    const test = setup(); test.send('craftside:news-received', { articles: [article('one')] });
    test.nodes.get('#news-toast').dataset.preview = 'true'; test.nodes.get('#news-toast-link').href = article('one').url;
    const writes = test.writes.length; test.click('news-toast-link'); assert.equal(glint(test.news), true); assert.equal(test.writes.length, writes);
  });
  await check('Gmail bookmark click keeps unread mail enchanted until Gmail reports zero', () => {
    const test = setup(true); test.pushGmail({ status: 'signed-in', unread: 3 }); assert.equal(glint(test.gmail), true);
    test.send('craftside:open-bookmark', { url: 'https://mail.google.com/' }); assert.equal(glint(test.gmail), true);
    test.pushGmail({ status: 'signed-in', unread: 0 }); assert.equal(glint(test.gmail), false); assert.equal(test.writes.length, 0);
  });
  await check('A delayed initial native reply cannot overwrite a newer unread update', async () => {
    const test = setup(true); test.pushGmail({ status: 'signed-in', unread: 7 }); test.resolveInitial({ status: 'unknown', unread: null }); await Promise.resolve();
    assert.equal(glint(test.gmail), true); assert.match(test.nodes.get('#gmail-session-status').textContent, /7 unread emails/);
  });
  await check('Logout clears the previous account indicator and asks for a normal Gmail sign-in', () => {
    const test = setup(true); test.pushGmail({ status: 'signed-in', unread: 2 }); test.pushGmail({ status: 'signed-out' });
    assert.equal(glint(test.gmail), false); assert.match(test.nodes.get('#gmail-session-status').textContent, /Sign in to Gmail once/);
  });
  await check('Enchantment preview ends after 20 seconds without storing or changing real notifications', () => {
    const test = setup(); test.click('preview-enchantment'); assert.equal(glint(test.news), true); assert.equal(glint(test.gmail), true); assert.equal(test.news.dataset.unread, 'false');
    const timer = [...test.timers.values()][0]; assert.equal(timer.delay, 20000); timer.fn();
    assert.equal(glint(test.news), false); assert.equal(glint(test.gmail), false); assert.equal(test.nodes.get('#unread-preview-note').hidden, true); assert.equal(test.writes.length, 0);
  });
  await check('Ending preview preserves genuine unread news and its stored count', () => {
    const test = setup(); test.send('craftside:news-received', { articles: [article('one')] }); test.click('preview-enchantment'); const raw = test.storage.get(Model.key);
    test.click('end-enchantment-preview'); assert.equal(glint(test.news), true); assert.equal(glint(test.gmail), false); assert.equal(test.storage.get(Model.key), raw);
  });
  await check('Remounted or changed icons receive a matching alpha mask for the same site', () => {
    const test = setup(true); test.pushGmail({ status: 'signed-in', unread: 2 }); test.gmail.image.src = 'diamond_helmet.png';
    test.window.CraftUnread.decorate(); assert.equal(glint(test.gmail), true); assert.equal(test.gmail.querySelector('.item-enchantment').attrs['--item-mask'], 'url("diamond_helmet.png")');
  });
  await check('Live unread labels translate to Korean without changing saved notifications', () => {
    const test = setup(true); test.pushGmail({ status: 'signed-in', unread: 4 }); test.send('craftside:news-received', { articles: [article('one')] }); const raw = test.storage.get(Model.key);
    test.window.CraftI18n.setLanguage('ko', false); test.send('craftside:language-changed'); assert.match(test.gmail.attrs['aria-label'], /안 읽은 메일 4개/); assert.equal(test.storage.get(Model.key), raw);
  });
  fs.writeFileSync(require('node:path').resolve(__dirname, '../design/evidence/v7/unread-controller.json'), JSON.stringify({ scope: 'Production unread.js executed against a DOM/event/bridge fixture; synthetic state only, no account access', checks }, null, 2));
  console.log(JSON.stringify({ passed: checks.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
