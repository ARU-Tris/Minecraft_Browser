(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CraftPackModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LIMITS = Object.freeze({ zip: 256 * 1024 * 1024, expanded: 192 * 1024 * 1024, file: 24 * 1024 * 1024, json: 2 * 1024 * 1024, entries: 50000, packs: 12, pixels: 16777216 });
  const fail = message => { throw Error(message); };
  const utf8 = new TextDecoder('utf-8');
  const table = Uint32Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  function crc32(data) { let crc = 0xffffffff; for (const byte of data) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
  function safePath(name) {
    return typeof name === 'string' && name.length > 0 && name.length <= 512 && !name.includes('\\') && !name.includes('//') && !/[\u0000-\u001f:]/.test(name) && !name.startsWith('/') && !name.split('/').some(part => part === '..' || part === '.');
  }
  function canonical(name) {
    if (!safePath(name) || !/^assets\/[a-z0-9_.-]+\/[a-z0-9_./-]+$/.test(name)) return null;
    return name.replace('/textures/items/', '/textures/item/').replace('/textures/blocks/', '/textures/block/');
  }
  function resource(name, type, suffix = '.png') {
    if (typeof name !== 'string' || !/^(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+$/.test(name)) return null;
    const [namespace, path] = name.includes(':') ? name.split(':') : ['minecraft', name];
    return canonical(`assets/${namespace}/${type}/${path}${suffix}`);
  }
  function directory(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (bytes.byteLength > LIMITS.zip) fail('Resource pack ZIP must be 256 MB or less.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), size = bytes.byteLength;
    if (size < 22) fail('Choose a valid Minecraft Java resource pack ZIP.');
    let end = -1;
    for (let i = size - 22; i >= Math.max(0, size - 65557); i--) if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === size) { end = i; break; }
    if (end < 0) fail('Choose a valid Minecraft Java resource pack ZIP.');
    const count = view.getUint16(end + 10, true), offset = view.getUint32(end + 16, true), length = view.getUint32(end + 12, true);
    if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || count !== view.getUint16(end + 8, true) || count === 65535 || offset === 0xffffffff || length === 0xffffffff) fail('Split and ZIP64 archives are not supported.');
    if (count > LIMITS.entries || offset + length > end) fail('Resource pack ZIP is too large or damaged.');
    const entries = [], names = new Set(); let at = offset;
    for (let i = 0; i < count; i++) {
      if (at + 46 > offset + length || view.getUint32(at, true) !== 0x02014b50) fail('Resource pack ZIP is damaged.');
      const flags = view.getUint16(at + 8, true), method = view.getUint16(at + 10, true), compressed = view.getUint32(at + 20, true), expanded = view.getUint32(at + 24, true);
      const nameLength = view.getUint16(at + 28, true), extraLength = view.getUint16(at + 30, true), commentLength = view.getUint16(at + 32, true), local = view.getUint32(at + 42, true);
      if (at + 46 + nameLength + extraLength + commentLength > offset + length) fail('Resource pack ZIP is damaged.');
      const name = utf8.decode(bytes.subarray(at + 46, at + 46 + nameLength));
      if (!safePath(name) || names.has(name)) fail('Resource pack ZIP contains unsafe or duplicate paths.');
      names.add(name);
      if (flags & 1) fail('Password-protected resource packs are not supported.');
      if (local + 30 > offset || view.getUint32(local, true) !== 0x04034b50) fail('Resource pack ZIP is damaged.');
      const data = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const localName = utf8.decode(bytes.subarray(local + 30, local + 30 + view.getUint16(local + 26, true)));
      if (localName !== name || method !== view.getUint16(local + 8, true) || data + compressed > offset) fail('Resource pack ZIP is damaged.');
      entries.push({ name, method, compressed, expanded, crc: view.getUint32(at + 16, true), data });
      at += 46 + nameLength + extraLength + commentLength;
    }
    if (at !== offset + length) fail('Resource pack ZIP is damaged.');
    return { bytes, entries };
  }
  async function extract(archive, entry, limit = LIMITS.file) {
    if (entry.expanded > limit) fail('A resource file exceeds the import size limit.');
    const compressed = archive.bytes.subarray(entry.data, entry.data + entry.compressed); let result;
    if (entry.method === 0) result = new Uint8Array(compressed);
    else if (entry.method === 8) {
      if (typeof DecompressionStream === 'undefined') fail('This browser does not support local ZIP decompression.');
      let stream; try { stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw')); } catch { fail('This browser does not support local ZIP decompression.'); }
      const reader = stream.getReader(), chunks = []; let total = 0;
      try {
        while (true) {
          const { value, done } = await reader.read(); if (done) break;
          total += value.length;
          if (total > limit || total > entry.expanded) { await reader.cancel(); fail('A resource file exceeds the import size limit.'); }
          chunks.push(value);
        }
      } catch (error) { throw Error(error.message.includes('limit') ? error.message : 'Resource pack ZIP is damaged.'); }
      result = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    } else fail('This ZIP compression method is not supported.');
    if (result.length !== entry.expanded || crc32(result) !== entry.crc) fail('Resource pack ZIP failed its integrity check.');
    return result;
  }
  function json(bytes) {
    try { return JSON.parse(utf8.decode(bytes).replace(/^\uFEFF/, '')); } catch { fail('Resource pack metadata contains invalid JSON.'); }
  }
  function version(value) {
    const parts = Array.isArray(value) ? value : [value, 0];
    return parts.length >= 1 && parts.length <= 2 && parts.every(n => Number.isSafeInteger(n) && n >= 0) ? [parts[0], parts[1] || 0] : null;
  }
  const compare = (a, b) => a[0] - b[0] || a[1] - b[1];
  function range(data) {
    if (!data || typeof data !== 'object') return null;
    let low, high;
    if (data.min_format !== undefined || data.max_format !== undefined) { low = version(data.min_format); high = version(data.max_format); }
    else {
      const supported = data.supported_formats ?? data.formats ?? data.pack_format;
      if (Array.isArray(supported)) { low = version(supported[0]); high = version(supported.at(-1)); }
      else if (typeof supported === 'object' && supported) { low = version(supported.min_inclusive); high = version(supported.max_inclusive); }
      else low = high = version(supported);
    }
    return low && high && compare(low, high) <= 0 ? { low, high } : null;
  }
  const within = (target, supported) => Boolean(supported && compare(target, supported.low) >= 0 && compare(target, supported.high) <= 0);
  function plain(value, depth = 0) {
    if (depth > 8) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.slice(0, 50).map(item => plain(item, depth + 1)).join('');
    if (value && typeof value === 'object') return plain(value.text || value.translate || '', depth + 1) + plain(value.extra || [], depth + 1);
    return '';
  }
  function png(bytes) {
    if (bytes.length < 33 || ![137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n) || utf8.decode(bytes.subarray(12, 16)) !== 'IHDR') fail('A resource texture is not a valid PNG.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), width = view.getUint32(16), height = view.getUint32(20);
    if (!width || !height || width > 8192 || height > 32768 || width * height > LIMITS.pixels) fail('A resource texture exceeds the image size limit.');
    return { width, height };
  }
  function supported(path) { return /^assets\/[a-z0-9_.-]+\/(?:textures\/.+\.(?:png|png\.mcmeta)|(?:models|items)\/.+\.json|sounds\/.+\.(?:ogg|wav)|sounds\.json)$/.test(path); }
  async function importPack(file, target = [88, 0], progress = () => {}) {
    if (file.size > LIMITS.zip) fail('Resource pack ZIP must be 256 MB or less.');
    const archive = directory(await file.arrayBuffer());
    const candidates = archive.entries.filter(entry => /(?:^|\/)pack\.mcmeta$/.test(entry.name) && !entry.name.startsWith('__MACOSX/')).sort((a, b) => a.name.split('/').length - b.name.split('/').length);
    if (!candidates.length) fail(archive.entries.some(entry => /(?:^|\/)manifest\.json$/.test(entry.name)) ? 'This is a Bedrock pack. Choose a Java Edition resource pack ZIP.' : 'pack.mcmeta was not found. Choose a Java Edition resource pack ZIP.');
    if (candidates.length > 1 && candidates[0].name.split('/').length === candidates[1].name.split('/').length) fail('This ZIP contains more than one resource pack.');
    const metadata = json(await extract(archive, candidates[0], LIMITS.json)), formats = range(metadata.pack);
    if (!metadata.pack || !formats) fail('Resource pack metadata is missing a valid format range.');
    if (metadata.overlays?.entries && !Array.isArray(metadata.overlays.entries)) fail('Resource pack metadata contains invalid JSON.');
    const root = candidates[0].name.slice(0, -'pack.mcmeta'.length), overlays = [];
    for (const entry of metadata.overlays?.entries || []) {
      if (safePath(entry.directory) && !entry.directory.endsWith('/') && within(target, range(entry))) overlays.push(root + entry.directory + '/');
    }
    const effective = new Map(); let expanded = 0;
    for (const prefix of [root, ...overlays]) {
      for (const entry of archive.entries) {
        if (!entry.name.startsWith(prefix)) continue;
        const path = canonical(entry.name.slice(prefix.length));
        if (path && supported(path)) effective.set(path, entry);
      }
    }
    const icon = archive.entries.find(entry => entry.name === root + 'pack.png');
    const todo = [...effective]; if (icon) todo.push(['pack.png', icon]);
    for (const [, entry] of todo) { expanded += entry.expanded; if (entry.expanded > (entry.name.endsWith('.json') || entry.name.endsWith('.mcmeta') ? LIMITS.json : LIMITS.file) || expanded > LIMITS.expanded) fail('Supported resources exceed the 192 MB import limit.'); }
    if (!effective.size) fail('This pack has no supported browser resources.');
    const files = []; let index = 0;
    for (const [path, entry] of todo) {
      const bytes = await extract(archive, entry, path.endsWith('.json') || path.endsWith('.mcmeta') ? LIMITS.json : LIMITS.file);
      if (path.endsWith('.png')) png(bytes);
      const mime = path.endsWith('.png') ? 'image/png' : path.endsWith('.ogg') ? 'audio/ogg' : path.endsWith('.wav') ? 'audio/wav' : 'application/json';
      if (mime === 'audio/ogg' && utf8.decode(bytes.subarray(0, 4)) !== 'OggS' || mime === 'audio/wav' && (utf8.decode(bytes.subarray(0, 4)) !== 'RIFF' || utf8.decode(bytes.subarray(8, 12)) !== 'WAVE')) fail('A resource sound is not a valid OGG or WAV file.');
      files.push({ path, blob: new Blob([bytes], { type: mime }) });
      progress(++index, todo.length);
      if (index % 20 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', archive.bytes));
    return { id: [...digest].map(n => n.toString(16).padStart(2, '0')).join(''), name: String(file.name || 'Resource pack').replace(/\.zip$/i, '').slice(0, 120),
      description: plain(metadata.pack.description).replace(/§[0-9a-fklmnor]/gi, '').slice(0, 600), formats, compatible: within(target, formats), overlays: overlays.length,
      warnings: { shaders: archive.entries.some(entry => /(?:^|\/)shaders\//.test(entry.name)), extensions: archive.entries.some(entry => /(?:^|\/)(?:optifine|citresewn|polytone|continuity)\//.test(entry.name)), fonts: archive.entries.some(entry => /assets\/[^/]+\/font\//.test(entry.name)) },
      bytes: expanded, count: effective.size, files };
  }
  function stack(packs, active) {
    if (!Array.isArray(packs) || packs.length > LIMITS.packs || !Array.isArray(active) || new Set(active).size !== active.length || new Set(packs.map(pack => pack.id)).size !== packs.length || active.some(id => !packs.some(pack => pack.id === id))) fail('Saved resource packs are damaged. Your existing data was kept.');
    const result = new Map();
    for (const id of [...active].reverse()) {
      const pack = packs.find(pack => pack.id === id);
      if (!Array.isArray(pack.files)) fail('Saved resource packs are damaged. Your existing data was kept.');
      for (const file of pack.files) if (canonical(file.path) && supported(file.path) && file.blob instanceof Blob) result.set(file.path, file.blob);
    }
    return result;
  }
  function animation(meta, width, height) {
    const data = meta?.animation;
    if (!data) return { width, height, frames: [{ index: 0, time: 1000 }], animated: false };
    const w = data.width || Math.min(width, height), h = data.height || Math.min(width, height);
    if (![w, h].every(n => Number.isInteger(n) && n > 0) || width % w || height % h) fail('A texture animation has invalid frame dimensions.');
    const count = width / w * (height / h); if (count > 256) fail('A texture animation contains too many frames.');
    const frames = (data.frames || Array.from({ length: count }, (_, i) => i)).map(value => {
      const index = typeof value === 'number' ? value : value.index, ticks = typeof value === 'object' ? value.time ?? data.frametime ?? 1 : data.frametime ?? 1;
      if (!Number.isInteger(index) || index < 0 || index >= count || !Number.isInteger(ticks) || ticks < 1 || ticks > 12000) fail('A texture animation contains an invalid frame.');
      return { index, time: ticks * 50 };
    });
    if (!frames.length || frames.length > 512) fail('A texture animation contains too many frames.');
    return { width: w, height: h, frames, animated: frames.length > 1 };
  }
  function neutralModel(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 24) return null;
    const type = String(value.type || '').replace(/^minecraft:/, '');
    if (type === 'model') return typeof value.model === 'string' ? value : null;
    // Browser bookmark items are idle, undamaged and shown in the GUI context.
    if (type === 'condition') return neutralModel(value.on_false, depth + 1);
    if (type === 'range_dispatch') {
      if (!Array.isArray(value.entries) || value.entries.length > 512) return null;
      const entry = value.entries.filter(entry => Number.isFinite(entry.threshold) && entry.threshold <= 0).sort((a, b) => b.threshold - a.threshold)[0];
      return neutralModel(entry?.model || value.fallback, depth + 1);
    }
    if (type === 'select') {
      if (!Array.isArray(value.cases) || value.cases.length > 512) return null;
      const expected = value.property === 'minecraft:display_context' ? 'gui' : value.property === 'minecraft:charge_type' ? 'none' : null;
      const entry = expected && value.cases.find(entry => entry.when === expected || Array.isArray(entry.when) && entry.when.includes(expected));
      return neutralModel(entry?.model || value.fallback, depth + 1);
    }
    if (type === 'composite' && value.models?.length === 1) return neutralModel(value.models[0], depth + 1);
    return null;
  }
  return { limits: LIMITS, crc32, safePath, canonical, resource, directory, extract, json, version, range, within, plain, png, importPack, stack, animation, neutralModel };
});
