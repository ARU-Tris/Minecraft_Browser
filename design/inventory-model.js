(function (root, factory) {
  const Model = factory();
  if (typeof module === 'object' && module.exports) module.exports = Model;
  else root.CraftInventoryModel = Model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEY = 'craftside:inventory:v1';
  const LAYOUT = 'curated-20261019';
  const BACKUP_KEY = KEY + ':before-' + LAYOUT;
  const NEWS_BACKUP_KEY = KEY + ':before-news-20261019';
  const NEWS_URL = 'https://www.minecraft.net/en-us/article';
  const RESERVED = ['compass', 'nether_star', 'shears', 'barrier', 'crafting_table'];
  const PARTS = ['head', 'chest', 'legs', 'feet'];
  const clone = value => JSON.parse(JSON.stringify(value));
  class InventoryModel {
    constructor(items, storage, random = Math.random) {
      this.items = items; this.catalog = new Map(items.map(item => [item.id, item]));
      this.storage = storage; this.random = random; this.readOnly = false; this.loadError = null;
      this.data = this.seed(); this.lastSaved = null;
      try {
        const raw = storage.getItem(KEY);
        if (raw !== null) {
          this.data = this.parse(raw); this.lastSaved = raw;
          if (!this.data.layout) {
            const curated = this.validate(this.seed());
            // Back up the previous arrangement before the user's requested reset.
            // Once marked, future moves, additions and icon choices are retained.
            if (storage.getItem(BACKUP_KEY) === null) storage.setItem(BACKUP_KEY, raw);
            const replacement = JSON.stringify(curated);
            storage.setItem(KEY, replacement); this.data = curated; this.lastSaved = replacement;
          }
        }
        else { this.validate(this.data); this.lastSaved = JSON.stringify(this.data); storage.setItem(KEY, this.lastSaved); }
        if (!this.data.newsShortcut) this.installNewsShortcut();
      } catch (error) {
        this.readOnly = true;
        this.loadError = '인벤토리를 읽거나 저장하지 못했습니다. 기존 저장값을 보존하고 보기 모드로 열었습니다.';
      }
    }
    static get key() { return KEY; }
    static get backupKey() { return BACKUP_KEY; }
    static get newsBackupKey() { return NEWS_BACKUP_KEY; }
    static get layout() { return LAYOUT; }
    static get reserved() { return [...RESERVED]; }
    static normalizeURL(value) {
      const text = String(value || '').trim();
      if (['craftside://notes', 'craftside://reading'].includes(text)) return text;
      if (!text || text.length > 2048) throw Error('사이트 주소를 입력해 주세요.');
      const candidate = /^[a-z][a-z\d+.-]*:/i.test(text) ? text : 'https://' + text;
      let url;
      try { url = new URL(candidate); } catch { throw Error('올바른 사이트 주소를 입력해 주세요.'); }
      if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw Error('로그인 정보가 없는 http 또는 https 주소만 사용할 수 있습니다.');
      return url.href;
    }
    seed() {
      const data = { schema: 1, layout: LAYOUT, newsShortcut: true, entries: {}, slots: Array(36).fill(null), armor: { head: null, chest: null, legs: null, feet: null } };
      const seeds = [
        [0, 'pinterest', 'Pinterest', 'https://www.pinterest.com/', 'painting'],
        [1, 'maps', 'Google 지도', 'https://maps.google.com/', 'map'],
        [2, 'youtube', 'YouTube', 'https://www.youtube.com/', 'redstone'],
        [3, 'naver', 'NAVER', 'https://www.naver.com/', 'emerald'],
        [4, 'gpt', 'ChatGPT', 'https://chatgpt.com/', 'ominous_bottle'],
        [9, 'school', '성균관대학교', 'https://login.skku.edu/?retUrl=kc213u9an72n4n33c5l9', 'book'],
        [10, 'gmail', 'Gmail', 'https://mail.google.com/', 'writable_book'],
        [11, 'goorm', 'SKKU 구름', 'https://skku.goorm.io/learn/my', 'cyan_dye'],
        [27, 'github', 'GitHub', 'https://github.com/', 'stone_axe'],
        [28, 'minecraft', 'Minecraft', 'https://www.minecraft.net/', 'diamond_pickaxe'],
        [29, 'minecart', 'LEEPLAY', 'https://www.youtube.com/watch?v=hX05fEhumVA&t=162s', 'minecart'],
        [35, 'minecraft-news', 'Minecraft News', NEWS_URL, 'water_bucket']
      ];
      seeds.forEach(([index, key, title, url, itemId]) => {
        if (!this.catalog.has(itemId)) return;
        const id = 'bookmark-' + key;
        data.entries[id] = { id, title, url, itemId }; data.slots[index] = id;
      });
      return data;
    }
    installNewsShortcut() {
      const before = this.snapshot(), raw = this.lastSaved;
      const existing = Object.values(this.data.entries).find(entry => entry.url.replace(/\/$/, '') === NEWS_URL);
      const iconOwner = Object.values(this.data.entries).find(entry => entry.itemId === 'water_bucket' && entry.id !== existing?.id);
      const free = this.data.slots.indexOf(null);
      if (!this.catalog.has('water_bucket') || iconOwner || (!existing && free < 0)) {
        this.loadError = 'Make an empty slot and keep the Water Bucket icon available to add Minecraft News. Your bookmarks were kept.';
        return;
      }
      try {
        if (this.storage.getItem(NEWS_BACKUP_KEY) === null) this.storage.setItem(NEWS_BACKUP_KEY, raw);
        let id = existing?.id || 'bookmark-minecraft-news';
        while (!existing && this.data.entries[id]) id += '-news';
        if (existing) {
          const source = this.location(id), displaced = this.data.slots[35];
          this.put(source, displaced); this.data.slots[35] = id; existing.itemId = 'water_bucket';
        } else {
          if (this.data.slots[35]) this.data.slots[free] = this.data.slots[35];
          this.data.entries[id] = { id, title: 'Minecraft News', url: NEWS_URL, itemId: 'water_bucket' }; this.data.slots[35] = id;
        }
        this.data.newsShortcut = true; this.validate(this.data);
        const next = JSON.stringify(this.data); this.storage.setItem(KEY, next); this.lastSaved = next;
      } catch (error) { this.data = before; throw error; }
    }
    validate(data) {
      if (!data || data.schema !== 1 || !data.entries || !Array.isArray(data.slots) || data.slots.length !== 36 || !data.armor) throw Error('인벤토리 형식이 맞지 않습니다.');
      const ids = new Set(), icons = new Set(), placed = [];
      for (const [id, entry] of Object.entries(data.entries)) {
        if (!/^bookmark-[a-z\d-]+$/i.test(id) || entry.id !== id || typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 80 || !this.catalog.has(entry.itemId)) throw Error('북마크 항목이 올바르지 않습니다.');
        InventoryModel.normalizeURL(entry.url);
        if (ids.has(id) || icons.has(entry.itemId)) throw Error('북마크 또는 아이템이 중복되었습니다.');
        if (data.layout === LAYOUT && RESERVED.includes(entry.itemId)) throw Error('고정 도구 아이콘은 사이트에 배정할 수 없습니다.');
        ids.add(id); icons.add(entry.itemId);
      }
      for (const id of data.slots) { if (id !== null) { if (!ids.has(id)) throw Error('없는 북마크입니다.'); placed.push(id); } }
      for (const part of PARTS) {
        const id = data.armor[part];
        if (id !== null) {
          if (!ids.has(id) || this.catalog.get(data.entries[id].itemId).armor?.slot !== part) throw Error('장비 슬롯이 맞지 않습니다.');
          placed.push(id);
        }
      }
      if (placed.length !== ids.size || new Set(placed).size !== placed.length) throw Error('아이템 위치가 중복되거나 누락되었습니다.');
      return data;
    }
    parse(raw) { return this.validate(JSON.parse(raw)); }
    snapshot() { return clone(this.data); }
    refreshFromStorage() {
      const raw = this.storage.getItem(KEY);
      if (raw !== null && raw !== this.lastSaved) { this.data = this.parse(raw); this.lastSaved = raw; }
    }
    change(action) {
      if (this.readOnly) throw Error(this.loadError || '인벤토리를 저장할 수 없습니다.');
      this.refreshFromStorage();
      const previous = this.snapshot();
      try {
        const result = action(); this.validate(this.data);
        const raw = JSON.stringify(this.data); this.storage.setItem(KEY, raw); this.lastSaved = raw;
        return result;
      } catch (error) { this.data = previous; throw error; }
    }
    restore(data) { return this.change(() => { this.data = this.validate(clone(data)); }); }
    title(value) {
      const title = String(value || '').trim();
      if (!title || title.length > 80) throw Error('사이트 이름은 1~80자로 입력해 주세요.');
      return title;
    }
    available(excludeItem = null) {
      const used = new Set(Object.values(this.data.entries).map(entry => entry.itemId));
      return this.items.filter(item => !used.has(item.id) && !RESERVED.includes(item.id) && item.id !== excludeItem);
    }
    canAssign(itemId, exceptId = null) {
      return this.catalog.has(itemId) && !RESERVED.includes(itemId) && !Object.values(this.data.entries).some(entry => entry.id !== exceptId && entry.itemId === itemId);
    }
    pick(excludeItem = null) {
      const items = this.available(excludeItem);
      if (!items.length) throw Error('배정할 수 있는 새 아이템이 없습니다.');
      return items[Math.min(items.length - 1, Math.floor(this.random() * items.length))];
    }
    add({ title, url, itemId, slot }) {
      return this.change(() => {
        title = this.title(title); url = InventoryModel.normalizeURL(url);
        if (!Number.isInteger(slot) || slot < 0 || slot > 35 || this.data.slots[slot]) slot = this.data.slots.indexOf(null);
        if (slot < 0) throw Error('인벤토리가 가득 찼습니다. 빈칸을 만든 뒤 추가해 주세요.');
        if (itemId && !this.canAssign(itemId)) throw Error('이미 사용 중이거나 고정 도구인 아이콘입니다. 다른 아이콘을 지정해 주세요.');
        const item = itemId ? this.catalog.get(itemId) : this.pick();
        const id = 'bookmark-' + Date.now().toString(36) + '-' + Math.floor(this.random() * 0x100000000).toString(36);
        if (this.data.entries[id]) throw Error('다시 한 번 추가해 주세요.');
        this.data.entries[id] = { id, title, url, itemId: item.id }; this.data.slots[slot] = id;
        return id;
      });
    }
    edit(id, { title, url, itemId }) {
      return this.change(() => {
        const entry = this.entry(id);
        if (itemId !== undefined) {
          if (!this.canAssign(itemId, id)) throw Error('이미 사용 중이거나 고정 도구인 아이콘입니다. 다른 아이콘을 지정해 주세요.');
          const location = this.location(id);
          if (location.type === 'armor' && this.catalog.get(itemId).armor?.slot !== location.key) {
            const free = this.data.slots.indexOf(null);
            if (free < 0) throw Error('착용 중인 아이콘을 바꾸려면 빈 인벤토리 칸이 필요합니다.');
            this.put(location, null); this.data.slots[free] = id;
          }
          entry.itemId = itemId;
        }
        entry.title = this.title(title); entry.url = InventoryModel.normalizeURL(url);
      });
    }
    entry(id) { const entry = this.data.entries[id]; if (!entry) throw Error('북마크를 찾지 못했습니다.'); return entry; }
    location(id) {
      const index = this.data.slots.indexOf(id); if (index >= 0) return { type: 'slot', key: index };
      const part = PARTS.find(part => this.data.armor[part] === id); if (part) return { type: 'armor', key: part };
      throw Error('아이템 위치를 찾지 못했습니다.');
    }
    target(target) {
      if (target.type === 'slot' && Number.isInteger(target.key) && target.key >= 0 && target.key < 36) return target;
      if (target.type === 'armor' && PARTS.includes(target.key)) return target;
      throw Error('놓을 수 없는 위치입니다.');
    }
    at(target) { this.target(target); return target.type === 'slot' ? this.data.slots[target.key] : this.data.armor[target.key]; }
    put(target, id) { if (target.type === 'slot') this.data.slots[target.key] = id; else this.data.armor[target.key] = id; }
    applyMove(id, target) {
      const entry = this.entry(id), source = this.location(id); this.target(target);
      if (source.type === target.type && source.key === target.key) return;
      if (target.type === 'armor' && this.catalog.get(entry.itemId).armor?.slot !== target.key) throw Error('이 칸에는 해당 부위의 갑옷만 착용할 수 있습니다.');
      let displaced = this.at(target);
      if (source.type === 'armor' && displaced && this.catalog.get(this.entry(displaced).itemId).armor?.slot !== source.key) {
        const free = this.data.slots.indexOf(null);
        if (free < 0) throw Error('인벤토리에 빈칸이 있어야 장비를 벗을 수 있습니다.');
        this.data.slots[free] = displaced; displaced = null;
      }
      this.put(source, displaced); this.put(target, id);
    }
    move(id, target) { return this.change(() => this.applyMove(id, target)); }
    equip(id) {
      const part = this.catalog.get(this.entry(id).itemId).armor?.slot;
      if (!part) throw Error('갑옷 아이템만 착용할 수 있습니다.');
      return this.move(id, { type: 'armor', key: part });
    }
    unequip(part) {
      const id = this.data.armor[part]; if (!id) return;
      return this.change(() => {
        const free = this.data.slots.indexOf(null);
        if (free < 0) throw Error('장비를 벗으려면 빈 인벤토리 칸이 필요합니다.');
        this.applyMove(id, { type: 'slot', key: free });
      });
    }
    remove(id) { return this.change(() => { this.entry(id); this.put(this.location(id), null); delete this.data.entries[id]; }); }
    equipment() {
      return Object.fromEntries(PARTS.map(part => { const id = this.data.armor[part]; return [part, id ? this.catalog.get(this.data.entries[id].itemId).armor : null]; }));
    }
  }
  return InventoryModel;
});
