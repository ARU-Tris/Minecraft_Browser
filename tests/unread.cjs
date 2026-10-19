'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const vm = require('node:vm');
const Model = require('../design/unread-model.js');
const News = require('../design/ambience-model.js');
const I18n = require('../design/i18n.js');
const Reader = require('../browser/gmail-reader.cjs');
const { watchGmailSession } = require('../browser/gmail-session.cjs');
const checks = [];
const check = async (name, action) => { await action(); checks.push({ name, passed: true }); };
class Storage {
  constructor(raw = null) { this.data = new Map(raw === null ? [] : [[Model.key, raw]]); this.fail = false; this.writes = []; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, raw) { if (this.fail) throw Error('Quota'); this.data.set(key, raw); this.writes.push(key); }
}
const article = (slug, published = 100) => ({ title: slug, url: 'https://www.minecraft.net/en-us/article/' + slug, published });
const href = 'https://mail.google.com/mail/u/0/';
function doc(title, rows = []) {
  return { title, querySelectorAll(selector) {
    assert.equal(selector, 'a[href]');
    return rows.map(row => ({
      getAttribute(name) { return name === 'href' ? row.href || '#inbox' : name === 'aria-label' ? row.label || '' : null; },
      textContent: row.text || '', closest() { return this; },
      querySelector(selector) { assert.equal(selector, '.bsU'); return Object.hasOwn(row, 'badge') ? { textContent: row.badge } : null; }
    }));
  } };
}
class Contents extends EventEmitter {
  constructor() { super(); this.url = href; this.destroyed = false; this.value = { status: 'signed-in', unread: 4 }; this.calls = 0; this.deferred = null; }
  isDestroyed() { return this.destroyed; }
  getURL() { return this.url; }
  async executeJavaScriptInIsolatedWorld(world, scripts) {
    assert.equal(world, 1101); assert.equal(scripts[0].code, Reader.script); this.calls++;
    if (this.deferred) return this.deferred;
    return this.value;
  }
}
const settle = () => new Promise(resolve => setImmediate(resolve));
function watch(contents) {
  const states = [], scheduler = { run: null, cancelled: false };
  const watcher = watchGmailSession(contents, state => states.push(state), {
    setInterval(fn, delay) { assert.equal(delay, 15000); scheduler.run = fn; return 1; },
    clearInterval(id) { assert.equal(id, 1); scheduler.cancelled = true; }
  });
  return { watcher, states, scheduler, latest: () => states.at(-1) };
}

(async () => {
  await check('Fresh profile has no fabricated unread state or storage writes', () => {
    const storage = new Storage(), store = new Model.Store(storage);
    assert.equal(store.newsCount, 0); assert.equal(store.error, false); assert.deepEqual(storage.writes, []);
  });
  await check('All newly delivered articles remain unread across reload, beyond the toast limit', () => {
    const baseline = News.ingestNews([article('old', 10)], null);
    const result = News.ingestNews([1, 2, 3, 4, 5].map(n => article('new-' + n, n + 20)), baseline.state);
    assert.equal(result.fresh.length, 3); assert.equal(result.discovered.length, 5);
    const storage = new Storage(), store = new Model.Store(storage); store.receive(result.discovered);
    assert.equal(new Model.Store(storage).newsCount, 5);
  });
  await check('Repeated deliveries and localized URLs do not duplicate an unread article', () => {
    const store = new Model.Store(new Storage()); store.receive([article('one'), article('one')]);
    store.receive([{ ...article('one'), url: 'https://minecraft.net/ko-kr/article/one?source=other' }]); assert.equal(store.newsCount, 1);
  });
  await check('Opening one article acknowledges just that article; opening the listing acknowledges all', () => {
    const storage = new Storage(), store = new Model.Store(storage); store.receive([article('one'), article('two')]);
    store.readArticle('https://www.minecraft.net/ko-kr/article/one');
    assert.deepEqual(new Model.Store(storage).data.news.map(a => a.id), ['/article/two']);
    store.readAllNews(); assert.equal(new Model.Store(storage).newsCount, 0);
    store.receive([article('three')]); assert.equal(store.newsCount, 1);
  });
  await check('Starting baseline, muted articles and invalid feeds never fabricate unread news', () => {
    assert.deepEqual(News.ingestNews([article('archive')], null).discovered, []);
    const baseline = News.ingestNews([article('old', 10)], null).state;
    assert.deepEqual(News.ingestNews([article('new', 20)], baseline, false).discovered, []);
    assert.deepEqual(News.ingestNews([{ url: 'broken' }], baseline).discovered, []);
  });
  await check('Another window acknowledgement is merged before the next delivery', () => {
    const storage = new Storage(), a = new Model.Store(storage), b = new Model.Store(storage);
    a.receive([article('one')]); b.refresh(); a.readAllNews(); b.receive([article('two')]);
    assert.deepEqual(new Model.Store(storage).data.news.map(a => a.id), ['/article/two']);
  });
  await check('Corrupt stored notifications are preserved and explicitly report save failure', () => {
    const raw = '{broken', storage = new Storage(raw), store = new Model.Store(storage);
    store.receive([article('one')]); assert.equal(store.newsCount, 1); assert.equal(store.error, true); assert.equal(storage.getItem(Model.key), raw);
  });
  await check('Quota failures preserve the in-memory unread state and retry it without loss', () => {
    const storage = new Storage(), store = new Model.Store(storage); storage.fail = true;
    store.receive([article('one')]); assert.equal(store.newsCount, 1); assert.equal(store.error, true);
    storage.fail = false; store.receive([article('two')]); assert.equal(new Model.Store(storage).newsCount, 2);
    assert(storage.writes.every(key => key === Model.key));
  });
  await check('Unsafe article URLs and corrupt duplicate records cannot become pending notifications', () => {
    const store = new Model.Store(new Storage()); store.receive([article('safe'), { ...article('bad'), url: 'https://evil.example/article/bad' }]); assert.equal(store.newsCount, 1);
    assert.throws(() => Model.parse(JSON.stringify({ schema: 1, news: [article('same'), article('same')] })));
  });
  await check('Notification identity follows the URL across names, positions and selected icons', () => {
    for (const url of ['https://mail.google.com/', href + '#sent', 'https://mail.google.com/mail/u/2/']) assert.equal(Model.kindForURL(url), 'gmail');
    for (const url of ['https://www.minecraft.net/en-us/article', 'https://minecraft.net/ko-kr/article/']) assert.equal(Model.kindForURL(url), 'news');
    for (const url of ['http://mail.google.com/', 'https://mail.google.com.evil.test/', 'https://user:pass@mail.google.com/', 'https://mail.google.com:5000/', 'https://minecraft.net/en-us/article/specific', 'javascript:alert(1)']) assert.equal(Model.kindForURL(url), null);
  });
  await check('Unknown or signed-out Gmail counts do not masquerade as zero or new mail', () => {
    assert.deepEqual(Model.gmailState({ status: 'signed-in', unread: 0 }), { status: 'signed-in', unread: 0 });
    assert.equal(Model.gmailState({ status: 'signed-in', unread: 3 }).unread, 3);
    for (const value of [null, { status: 'signed-in', unread: -1 }, { status: 'signed-in', unread: '2' }, { status: 'signed-out', unread: 8 }]) assert.equal(Model.gmailState(value).unread, null);
  });
  await check('New indicators have English defaults and Korean translations', () => {
    const ui = I18n.create(new Storage()); assert.equal(ui.t('{count} unread emails', { count: 3 }), '3 unread emails');
    ui.setLanguage('ko', false); assert.equal(ui.t('{count} unread emails', { count: 3 }), '안 읽은 메일 3개');
    assert.notEqual(ui.t('Preview enchantment'), 'Preview enchantment');
  });
  await check('Gmail English and Korean Inbox titles expose only unread counts', () => {
    assert.equal(Reader.readGmailUnread(doc('Inbox (1,234) - hidden@example.com - Gmail'), href).unread, 1234);
    assert.equal(Reader.readGmailUnread(doc('받은편지함 (7) - hidden@example.com - Gmail'), href).unread, 7);
    assert.equal(Reader.readGmailUnread(doc('Inbox - hidden@example.com - Gmail'), href).unread, 0);
  });
  await check('Inbox sidebar is authoritative over stale titles, even on Sent or Search', () => {
    assert.equal(Reader.readGmailUnread(doc('Inbox (8) - person - Gmail', [{ label: 'Inbox', badge: '' }]), href).unread, 0);
    assert.equal(Reader.readGmailUnread(doc('Sent - person - Gmail', [{ label: 'Inbox 3 unread', badge: '3' }]), href + '#sent').unread, 3);
    assert.equal(Reader.readGmailUnread(doc('검색 - person - Gmail', [{ label: '받은편지함', badge: '12' }]), href).unread, 12);
  });
  await check('Collapsed Inbox accessibility labels and capped positive counts remain detectable', () => {
    assert.equal(Reader.readGmailUnread(doc('Gmail', [{ label: 'Inbox (99+)' }]), href).unread, 99);
    assert.equal(Reader.readGmailUnread(doc('Gmail', [{ label: 'Inbox 3 unread messages' }]), href).unread, 3);
    assert.equal(Reader.readGmailUnread(doc('Gmail', [{ label: '받은편지함 (4)' }]), href).unread, 4);
  });
  await check('Mail subjects, account digits and other folders cannot impersonate Inbox unread counts', () => {
    for (const title of ['Gmail', 'Loading Gmail', 'Sent (55) - person2026 - Gmail', 'Report (9) - person - Gmail']) assert.equal(Reader.readGmailUnread(doc(title), href).status, 'unknown');
    assert.equal(Reader.readGmailUnread(doc('Gmail', [{ href: '#sent', label: 'Inbox 55' }, { href: 'https://evil.test/#inbox', label: 'Inbox 99' }]), href).status, 'unknown');
    assert.deepEqual(Object.keys(Reader.readGmailUnread(doc('Inbox (8) - private@example.com - Gmail'), href)), ['status', 'unread']);
  });
  await check('Reader refuses non-Gmail, sign-in and malformed pages without inspecting DOM', () => {
    const forbidden = { querySelectorAll() { throw Error('No DOM access allowed'); } };
    for (const url of ['https://accounts.google.com/', 'https://mail.google.com.evil.test/', 'http://mail.google.com/mail/u/0/', 'https://mail.google.com/mail/mu/', 'https://user:pass@mail.google.com/mail/u/0/']) assert.equal(Reader.readGmailUnread(forbidden, url).status, 'unknown');
  });
  await check('The native isolated-world script runs standalone with no Node or privileged API', () => {
    const result = vm.runInNewContext(Reader.script, { document: doc('Inbox (6) - person - Gmail'), location: { href }, URL });
    assert.equal(result.unread, 6); assert.equal(result.status, 'signed-in');
  });
  await check('Native watcher samples on login and title changes and clears only authoritative zero', async () => {
    const contents = new Contents(), test = watch(contents); await settle(); assert.equal(test.latest().unread, 4);
    contents.value = { status: 'unknown', unread: null }; contents.emit('page-title-updated'); await settle(); assert.equal(test.latest().unread, 4);
    contents.value = { status: 'signed-in', unread: 0 }; contents.emit('page-title-updated'); await settle(); assert.equal(test.latest().unread, 0);
    test.watcher.stop(); assert.equal(test.scheduler.cancelled, true); assert.equal(contents.eventNames().length, 0);
  });
  await check('Logged-out and unrelated pages are never injected or falsely counted', async () => {
    const contents = new Contents(); contents.url = 'https://accounts.google.com/ServiceLogin'; const test = watch(contents); await settle();
    assert.equal(test.latest().status, 'signed-out'); assert.equal(contents.calls, 0);
    contents.url = 'https://example.com/'; await test.watcher.sample(); assert.equal(test.latest().status, 'unavailable'); assert.equal(contents.calls, 0); test.watcher.stop();
  });
  await check('Switching Gmail accounts discards the old account count before the new snapshot', async () => {
    const contents = new Contents(), test = watch(contents); await settle(); assert.equal(test.latest().unread, 4);
    contents.url = 'https://mail.google.com/mail/u/1/'; contents.value = { status: 'unknown' }; contents.emit('did-navigate'); await settle(); assert.equal(test.latest().status, 'unknown');
    contents.value = { status: 'signed-in', unread: 2 }; test.scheduler.run(); await settle(); assert.equal(test.latest().unread, 2); test.watcher.stop();
  });
  await check('An in-flight reply from the old page cannot leak a stale unread count', async () => {
    const contents = new Contents(); let resolve; contents.deferred = new Promise(done => { resolve = done; });
    const test = watch(contents); contents.emit('did-start-navigation', {}, 'https://accounts.google.com/', false, true); contents.url = 'https://accounts.google.com/';
    resolve({ status: 'signed-in', unread: 700 }); await settle(); assert.notEqual(test.latest().unread, 700);
    await test.watcher.sample(); assert.equal(test.latest().status, 'signed-out'); test.watcher.stop();
  });
  await check('Destroying a Gmail view cleans timers and listeners before pending work completes', async () => {
    const contents = new Contents(), test = watch(contents); await settle(); contents.destroyed = true; contents.emit('destroyed');
    assert.equal(test.latest().status, 'unavailable'); assert.equal(test.scheduler.cancelled, true); assert.equal(contents.eventNames().length, 0);
  });
  const out = path.resolve(__dirname, '../design/evidence/v7'); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'unread-model.json'), JSON.stringify({ scope: 'News persistence, read acknowledgements, Gmail DOM fixtures and mocked native lifecycle. Live signed-in Gmail not tested: the design has no native tab engine.', checks }, null, 2));
  console.log(JSON.stringify({ passed: checks.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
