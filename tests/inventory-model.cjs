const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Model = require('../design/inventory-model.js');
const catalog = require('../assets/minecraft/catalog.json').items;
const checks = [];
const check = (name, action) => { action(); checks.push({ name, passed: true }); };
class Storage {
  constructor() { this.values = new Map(); this.failWrites = false; this.failKey = null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { if (this.failWrites || key === this.failKey) throw Error('Quota exceeded'); this.values.set(key, value); }
}
let randomSeed = 31;
const random = () => { randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0; return randomSeed / 0x100000000; };
const storage = new Storage(), model = new Model(catalog, storage, random);
const idFor = itemId => Object.values(model.data.entries).find(entry => entry.itemId === itemId).id;
const legacy = () => ({ schema: 1, entries: { 'bookmark-old': { id: 'bookmark-old', title: 'Previous site', url: 'https://example.com/old', itemId: 'diamond_helmet' } }, slots: ['bookmark-old', ...Array(35).fill(null)], armor: { head: null, chest: null, legs: null, feet: null } });
check('Requested layout retains the curated sites and adds Water Bucket to hotbar nine', () => {
  const expected = { 0: 'painting', 1: 'map', 2: 'redstone', 3: 'emerald', 4: 'ominous_bottle', 9: 'book', 10: 'writable_book', 11: 'cyan_dye', 27: 'stone_axe', 28: 'diamond_pickaxe', 29: 'minecart', 35: 'water_bucket' };
  model.data.slots.forEach((id, slot) => assert.equal(id ? model.entry(id).itemId : undefined, expected[slot]));
  assert.equal(Object.keys(model.data.entries).length, 12); assert.equal(model.data.layout, Model.layout);
});
check('School, goorm and minecart retain the exact supplied URLs', () => {
  assert.equal(model.entry(idFor('book')).url, 'https://login.skku.edu/?retUrl=kc213u9an72n4n33c5l9');
  assert.equal(model.entry(idFor('cyan_dye')).url, 'https://skku.goorm.io/learn/my');
  assert.equal(model.entry(idFor('minecart')).url, 'https://www.youtube.com/watch?v=hX05fEhumVA&t=162s');
});
check('The requested replacement backs up the previous layout byte-for-byte exactly once', () => {
  const old = new Storage(), raw = JSON.stringify(legacy()); old.setItem(Model.key, raw);
  const upgraded = new Model(catalog, old); assert.equal(upgraded.readOnly, false); assert.equal(old.getItem(Model.backupKey), raw);
  upgraded.move('bookmark-pinterest', { type: 'slot', key: 22 });
  upgraded.edit('bookmark-pinterest', { title: 'Edited Pinterest', url: 'https://www.pinterest.com/', itemId: 'amethyst_shard' });
  assert.deepEqual(new Model(catalog, old).snapshot(), upgraded.snapshot()); assert.equal(old.getItem(Model.backupKey), raw);
});
check('A failed backup prevents replacement and preserves the previous live arrangement', () => {
  const old = new Storage(), raw = JSON.stringify(legacy()); old.setItem(Model.key, raw); old.failKey = Model.backupKey;
  const view = new Model(catalog, old); assert.equal(view.readOnly, true); assert.equal(old.getItem(Model.key), raw); assert.deepEqual(view.snapshot(), legacy());
});
check('A failed replacement retains the previous arrangement and its successful backup', () => {
  const old = new Storage(), raw = JSON.stringify(legacy()); old.setItem(Model.key, raw); old.failKey = Model.key;
  const view = new Model(catalog, old); assert.equal(view.readOnly, true); assert.equal(old.getItem(Model.key), raw); assert.equal(old.getItem(Model.backupKey), raw); assert.deepEqual(view.snapshot(), legacy());
});
check('First inventory has unique actual item types', () => { const ids = Object.values(model.data.entries).map(entry => entry.itemId); assert.equal(ids.length, new Set(ids).size); });
check('Moving to a numbered hotbar slot survives reloading', () => {
  const id = idFor('book'); model.move(id, { type: 'slot', key: 30 });
  assert.equal(new Model(catalog, storage).data.slots[30], id); assert.equal(model.data.slots[9], null);
});
check('Occupied inventory slots swap without losing bookmarks', () => {
  const book = idFor('book'), map = idFor('map'), before = Object.keys(model.data.entries).length;
  model.move(book, { type: 'slot', key: 1 }); assert.equal(model.data.slots[30], map); assert.equal(model.data.slots[1], book); assert.equal(Object.keys(model.data.entries).length, before);
});
check('Only the matching armor piece may enter each equipment slot', () => {
  const previous = model.snapshot(); assert.throws(() => model.move(idFor('book'), { type: 'armor', key: 'head' })); assert.deepEqual(model.snapshot(), previous);
});
check('Equipped armor leaves inventory and persists', () => {
  model.add({ title: 'Helmet site', url: 'https://example.com/helmet', itemId: 'diamond_helmet' });
  const id = idFor('diamond_helmet'); model.equip(id); assert.equal(model.data.armor.head, id); assert.equal(model.data.slots.includes(id), false);
  assert.equal(new Model(catalog, storage).equipment().head.material, 'diamond');
});
check('Equipped armor can move onto an occupied non-armor slot safely', () => {
  const helmet = idFor('diamond_helmet'), book = idFor('book'); model.move(helmet, { type: 'slot', key: 1 });
  assert.equal(model.data.slots[1], helmet); assert.equal(model.data.armor.head, null); assert(model.data.slots.includes(book));
});
check('New sites receive an unused item and normalized URL', () => {
  const old = new Set(Object.values(model.data.entries).map(entry => entry.itemId));
  const id = model.add({ title: 'My workspace', url: 'example.com' }); assert.equal(model.entry(id).url, 'https://example.com/'); assert.equal(old.has(model.entry(id).itemId), false);
  assert.equal(Model.reserved.includes(model.entry(id).itemId), false); assert(model.available().every(item => !Model.reserved.includes(item.id)));
});
check('Duplicate, reserved and unknown explicit icons are rejected without random substitution', () => {
  for (const itemId of ['book', ...Model.reserved, 'not-an-item']) {
    const before = model.snapshot(); assert.throws(() => model.add({ title: 'Other workspace', url: 'https://example.org', itemId })); assert.deepEqual(model.snapshot(), before);
  }
});
check('A manually selected icon is saved exactly and survives reload', () => {
  const id = model.add({ title: 'Chosen icon', url: 'https://example.com/chosen', itemId: 'amethyst_shard' });
  assert.equal(new Model(catalog, storage).entry(id).itemId, 'amethyst_shard');
});
check('Editing an icon keeps the URL, title and position; its own icon remains selectable', () => {
  const id = idFor('amethyst_shard'), entry = { ...model.entry(id) }, location = model.location(id);
  model.edit(id, { ...entry, itemId: 'apple' }); assert.equal(model.entry(id).itemId, 'apple'); assert.deepEqual(model.location(id), location); assert.equal(model.entry(id).url, entry.url);
  assert.equal(model.canAssign('apple', id), true); assert.equal(model.canAssign('book', id), false);
  const before = model.snapshot(); assert.throws(() => model.edit(id, { ...entry, itemId: 'book' })); assert.deepEqual(model.snapshot(), before);
});
check('Changing an equipped icon to a regular item returns it safely to inventory', () => {
  const id = idFor('diamond_helmet'), entry = { ...model.entry(id) }; model.equip(id);
  model.edit(id, { ...entry, itemId: 'amethyst_shard' }); assert.equal(model.data.armor.head, null); assert.equal(model.location(id).type, 'slot');
  model.edit(id, entry);
});
check('Editing a URL preserves item assignment and slot', () => {
  const id = idFor('book'), previous = { item: model.entry(id).itemId, location: model.location(id) };
  model.edit(id, { title: '새 이름', url: 'https://example.net/path?q=one' }); assert.equal(model.entry(id).itemId, previous.item); assert.deepEqual(model.location(id), previous.location);
});
check('Unsafe URL schemes and embedded credentials are rejected', () => {
  for (const url of ['javascript:alert(1)', 'file:///C:/test', 'data:text/html,bad', 'https://user:secret@example.com/']) assert.throws(() => Model.normalizeURL(url));
});
check('Failed storage writes roll back both item data and position', () => {
  const before = model.snapshot(), raw = storage.getItem(Model.key); storage.failWrites = true;
  assert.throws(() => model.edit(idFor('book'), { title: 'Failed edit', url: 'https://example.com/', itemId: 'amethyst_shard' }));
  assert.throws(() => model.move(idFor('book'), { type: 'slot', key: 30 })); assert.deepEqual(model.snapshot(), before); assert.equal(storage.getItem(Model.key), raw); storage.failWrites = false;
});
check('Corrupt saved data is retained and opens in read-only mode', () => {
  const broken = new Storage(); broken.setItem(Model.key, '{broken'); const view = new Model(catalog, broken); assert.equal(view.readOnly, true);
  assert.throws(() => view.add({ title: 'No overwrite', url: 'https://example.com' })); assert.equal(broken.getItem(Model.key), '{broken');
});
check('A second model sees fresh saved data before writing', () => {
  const other = new Model(catalog, storage, random), before = Object.keys(model.data.entries).length;
  other.add({ title: 'Another tab', url: 'https://example.org/tab' }); model.add({ title: 'This tab', url: 'https://example.org/this' });
  assert.equal(Object.keys(model.data.entries).length, before + 2);
});
check('Another window taking a chosen icon causes a safe retry without duplication', () => {
  const other = new Model(catalog, storage, random), icon = model.pick().id;
  other.add({ title: 'Other choice', url: 'https://example.com/other', itemId: icon });
  assert.throws(() => model.add({ title: 'Stale choice', url: 'https://example.com/stale', itemId: icon }));
  assert.equal(Object.values(model.data.entries).filter(entry => entry.itemId === icon).length, 1);
});
check('Filling inventory does not produce duplicate item types', () => {
  model.add({ title: 'Chestplate site', url: 'https://example.com/chestplate', itemId: 'diamond_chestplate' });
  while (model.data.slots.includes(null)) model.add({ title: 'Saved site', url: 'https://example.com' });
  const icons = Object.values(model.data.entries).map(entry => entry.itemId); assert.equal(icons.length, new Set(icons).size);
});
check('Full inventory rejects another bookmark without changing data', () => {
  const before = model.snapshot(); assert.throws(() => model.add({ title: 'Overflow', url: 'https://example.com' })); assert.deepEqual(model.snapshot(), before);
});
check('Equipping, filling the freed slot, then unequipping cannot lose an item', () => {
  model.equip(idFor('diamond_chestplate')); model.add({ title: 'Fill the freed slot', url: 'https://example.com/full' });
  const before = model.snapshot(); assert.throws(() => model.unequip('chest')); assert.deepEqual(model.snapshot(), before);
  assert.throws(() => model.edit(idFor('diamond_chestplate'), { title: 'No free slot', url: 'https://example.com/', itemId: model.pick().id })); assert.deepEqual(model.snapshot(), before);
});
check('Deleting and restoring a bookmark retains all URLs and placements', () => {
  const before = model.snapshot(); model.remove(idFor('book')); model.restore(before); assert.deepEqual(model.snapshot(), before);
});
check('A complete saved inventory validates and round-trips', () => { assert.deepEqual(new Model(catalog, storage).snapshot(), model.snapshot()); });
const output = path.resolve(__dirname, '../design/evidence/v6'); fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'inventory-model.json'), JSON.stringify({ recordedOn: '2026-10-19', scope: 'Requested layout, backed-up migration, manual icon choice, inventory persistence and safe failure behavior; no browser runtime claim', checks }, null, 2));
console.log(JSON.stringify({ passed: checks.length }));
