(() => {
  'use strict';
  const M = window.CraftPackModel;
  const originals = { assets: structuredClone(window.CraftAssets), ambience: structuredClone(window.CraftAmbienceAssets) };
  let basePromise;
  const base = () => basePromise ||= fetch('../assets/resource-base.json').then(response => { if (!response.ok) throw Error('Could not load default resource information.'); return response.json(); }).catch(error => { basePromise = null; throw error; });
  const canvas = (width, height) => { const node = document.createElement('canvas'); node.width = width; node.height = height; return node; };
  const toBlob = node => new Promise((resolve, reject) => node.toBlob(blob => blob ? resolve(blob) : reject(Error('Could not render a resource texture.')), 'image/png'));
  async function prepare(packs, active, progress = () => {}) {
    const info = await base(), files = M.stack(packs, active), urls = new Set(), aliases = new Map(), replacements = new Map(), animations = new Map(), bitmaps = new Set(), images = new Map(), metadata = new Map(), sprites = new Map();
    const owners = new Map();
    active.forEach((id, rank) => packs.find(pack => pack.id === id).files.forEach(file => { if (!owners.has(file.path)) owners.set(file.path, rank); }));
    const stats = { items: 0, gui: 0, armor: 0, sounds: 0, modelsSkipped: 0, animations: 0 }, animationSources = new Map();
    const keyFor = new Map(Object.entries(info.bindings).map(([src, key]) => [src, key]));
    const sourceFor = new Map(Object.entries(info.bindings).map(([src, key]) => [key, src]));
    const makeURL = blob => { const url = URL.createObjectURL(blob); urls.add(url); return url; };
    const dispose = () => { urls.forEach(url => URL.revokeObjectURL(url)); bitmaps.forEach(image => image.close?.()); urls.clear(); bitmaps.clear(); };
    const readJSON = async path => {
      if (!metadata.has(path)) metadata.set(path, files.has(path) ? files.get(path).text().then(text => M.json(new TextEncoder().encode(text))) : Promise.resolve(null));
      return metadata.get(path);
    };
    async function image(path) {
      if (!path) return null;
      if (!images.has(path)) images.set(path, (async () => {
        const blob = files.get(path) || (sourceFor.has(path) ? await fetch(sourceFor.get(path)).then(response => response.ok ? response.blob() : null) : null);
        if (!blob) return null;
        let bitmap; try { bitmap = await createImageBitmap(blob); } catch { throw Error('A resource texture could not be decoded. Your current resources were kept.'); }
        bitmaps.add(bitmap); return bitmap;
      })());
      return images.get(path);
    }
    async function sprite(path, animate = false) {
      if (!files.has(path)) return null;
      const cacheKey = path + ':' + animate;
      if (!sprites.has(cacheKey)) sprites.set(cacheKey, (async () => {
        const source = await image(path), meta = await readJSON(path + '.mcmeta');
        const sequence = M.animation(meta, source.width, source.height), frameURLs = new Map();
        if (!meta?.animation) return { url: makeURL(files.get(path)), width: source.width, height: source.height };
        const indexes = animate ? [...new Set(sequence.frames.map(frame => frame.index))] : [sequence.frames[0].index];
        for (const index of indexes) {
          const output = canvas(sequence.width, sequence.height), context = output.getContext('2d'); context.imageSmoothingEnabled = false;
          context.drawImage(source, index % (source.width / sequence.width) * sequence.width, Math.floor(index / (source.width / sequence.width)) * sequence.height, sequence.width, sequence.height, 0, 0, sequence.width, sequence.height);
          frameURLs.set(index, makeURL(await toBlob(output)));
        }
        const url = frameURLs.get(sequence.frames[0].index);
        if (animate && sequence.animated) { animations.set(path, { frames: sequence.frames.map(frame => ({ ...frame, url: frameURLs.get(frame.index) })), duration: sequence.frames.reduce((sum, frame) => sum + frame.time, 0) }); stats.animations++; }
        return { url, width: sequence.width, height: sequence.height, animation: animate && sequence.animated ? path : null };
      })());
      return sprites.get(cacheKey);
    }
    const bind = (original, replacement, animation = null) => {
      if (!original || !replacement) return;
      replacements.set(original, replacement); aliases.set(replacement, original);
      if (animation) { animationSources.set(original, animation); for (const frame of animations.get(animation).frames) aliases.set(frame.url, original); }
    };
    const namespace = name => name.includes(':') ? name : 'minecraft:' + name;
    const modelCache = new Map();
    async function model(name, chain = []) {
      if (typeof name !== 'string') return null;
      name = namespace(name);
      if (chain.includes(name) || chain.length > 24) return null;
      if (modelCache.has(name)) return modelCache.get(name);
      const path = M.resource(name, 'models', '.json'); if (!path) return null;
      const raw = await readJSON(path) || info.models[name];
      if (!raw) return name.endsWith('/generated') || name.endsWith('/handheld') ? { textures: {}, changed: false } : null;
      const parent = raw.parent ? await model(raw.parent, [...chain, name]) : {};
      if (!parent) return null;
      const result = { ...parent, ...raw, textures: { ...parent.textures, ...raw.textures }, changed: Boolean(parent.changed || files.has(path)) };
      modelCache.set(name, result); return result;
    }
    function texture(name, textures) {
      const seen = new Set();
      while (typeof name === 'string' && name.startsWith('#')) { if (seen.has(name)) return null; seen.add(name); name = textures[name.slice(1)]; }
      return M.resource(name, 'textures');
    }
    async function modelIcon(item, definition, force) {
      const raw = M.neutralModel(definition?.model);
      if (!raw) { if (force) stats.modelsSkipped++; return null; }
      const data = await model(raw.model); if (!data) { if (force) stats.modelsSkipped++; return null; }
      if (Array.isArray(data.elements) && data.elements.length && data.elements.length <= 64) {
        const used = new Set(data.elements.flatMap(element => Object.values(element.faces || {}).map(face => texture(face.texture, data.textures))));
        if (!force && !data.changed && ![...used].some(path => files.has(path))) return null;
        try {
          const rendered = await drawModel(data, image, texture); if (!rendered) { stats.modelsSkipped++; return null; }
          return { url: makeURL(await toBlob(rendered)) };
        } catch { stats.modelsSkipped++; return null; }
      }
      const layers = Object.keys(data.textures || {}).filter(key => /^layer\d+$/.test(key)).sort().map(key => texture(data.textures[key], data.textures));
      if (!layers.length) { if (force) stats.modelsSkipped++; return null; }
      if (!force && !data.changed && !layers.some(path => files.has(path))) return null;
      if (layers.length === 1 && files.has(layers[0])) return sprite(layers[0], true);
      const source = await Promise.all(layers.map(image)); if (source.some(value => !value)) { stats.modelsSkipped++; return null; }
      const output = canvas(Math.min(512, Math.max(...source.map(value => value.width))), Math.min(512, Math.max(...source.map(value => Math.min(value.width, value.height))))), context = output.getContext('2d'); context.imageSmoothingEnabled = false;
      for (const layer of source) context.drawImage(layer, 0, 0, layer.width, Math.min(layer.width, layer.height), 0, 0, output.width, output.height);
      return { url: makeURL(await toBlob(output)) };
    }
    try {
      const itemSources = new Map(), equipment = structuredClone(originals.assets.equipment), gui = { ...originals.assets.gui }, effects = structuredClone(originals.ambience.effects), tracks = structuredClone(originals.ambience.tracks);
      let index = 0;
      for (const item of originals.assets.items) {
        const key = keyFor.get(item.src), itemPath = M.resource('minecraft:' + item.id, 'items', '.json'), legacyModel = M.resource('minecraft:item/' + item.id, 'models', '.json');
        const customDefinition = await readJSON(itemPath), force = Boolean(customDefinition || files.has(legacyModel));
        let result = null;
        if (force) result = await modelIcon(item, customDefinition || { model: { type: 'minecraft:model', model: 'minecraft:item/' + item.id } }, true);
        if (!result && key && files.has(key)) result = await sprite(key, true);
        if (!result && !force) result = await modelIcon(item, info.items[item.id], false);
        if (result) { itemSources.set(item.id, result.url); bind(item.src, result.url, result.animation); stats.items++; }
        if (++index % 40 === 0) { progress(index, originals.assets.items.length); await new Promise(resolve => setTimeout(resolve, 0)); }
      }
      const css = new Map();
      const guiVars = { inventory: 'inventory', button: 'button', buttonHover: 'button-hover', buttonDisabled: 'button-disabled', helmetSlot: 'helmet-slot', chestSlot: 'chest-slot', legsSlot: 'legs-slot', feetSlot: 'feet-slot', shieldSlot: 'shield-slot', creativeSearch: 'creative-search', creativeScroller: 'creative-scroller', creativeTab: 'creative-tab', creativeTabSelected: 'creative-tab-selected' };
      const widgetPath = 'assets/minecraft/textures/gui/widgets.png';
      for (const [name, source] of Object.entries(originals.assets.gui)) {
        const path = keyFor.get(source); let result = path ? await sprite(path) : null;
        // Before GUI sprites were split, the three buttons lived in widgets.png.
        if (files.has(widgetPath) && ['button', 'buttonHover', 'buttonDisabled'].includes(name) && (!result || owners.get(widgetPath) < owners.get(path))) {
          const sheet = await image(widgetPath), scale = sheet.width / 256, y = { button: 66, buttonHover: 86, buttonDisabled: 46 }[name];
          if (sheet.height >= (y + 20) * scale) { const output = canvas(200 * scale, 20 * scale); output.getContext('2d').drawImage(sheet, 0, y * scale, 200 * scale, 20 * scale, 0, 0, output.width, output.height); result = { url: makeURL(await toBlob(output)), width: output.width, height: output.height }; }
        }
        if (result) {
          gui[name] = result.url; bind(source, result.url); stats.gui++;
          if (guiVars[name]) css.set('--pack-' + guiVars[name], `url("${result.url}")`);
          if (['button', 'buttonHover', 'buttonDisabled'].includes(name)) {
            const meta = path ? await readJSON(path + '.mcmeta') : null, scaling = meta?.gui?.scaling, border = scaling?.border ?? 3;
            const values = typeof border === 'object' ? [border.top, border.right, border.bottom, border.left] : [border];
            if (values.every(value => Number.isFinite(value) && value >= 0 && value <= 100)) css.set('--pack-' + guiVars[name] + '-slice', values.map(value => value * result.width / (scaling?.width || 200)).join(' '));
          }
        }
      }
      for (const [material, layers] of Object.entries(equipment)) for (const [layer, source] of Object.entries(layers)) {
        const modern = keyFor.get(source), legacy = `assets/minecraft/textures/models/armor/${material === 'turtle_scute' ? 'turtle' : material}_layer_${layer === 'legs' ? 2 : 1}.png`;
        const path = files.has(legacy) && (!files.has(modern) || owners.get(legacy) < owners.get(modern)) ? legacy : files.has(modern) ? modern : null;
        if (path) { const result = await sprite(path); equipment[material][layer] = result.url; bind(source, result.url); stats.armor++; }
      }
      const glint = await sprite('assets/minecraft/textures/misc/enchanted_glint_item.png');
      if (glint) css.set('--pack-glint', `url("${glint.url}")`);
      const advancement = await sprite('assets/minecraft/textures/gui/sprites/toast/advancement.png');
      if (advancement) css.set('--pack-advancement', `url("${advancement.url}")`);
      for (const [name, choices] of Object.entries(effects)) effects[name] = choices.map(source => {
        const path = keyFor.get(source); if (!files.has(path)) return source;
        const url = makeURL(files.get(path)); stats.sounds++; return url;
      });
      const sounds = await readJSON('assets/minecraft/sounds.json');
      const eventNames = { click: 'ui.button.click', toastIn: 'ui.toast.in', toastOut: 'ui.toast.out', challenge: 'ui.toast.challenge_complete', cave: 'ambient.cave' };
      for (const name of Object.keys(effects)) {
        const event = eventNames[name] || (name.startsWith('equip_') ? 'item.armor.equip_' + name.slice(6) : '');
        const definition = sounds?.[event]; if (!definition?.sounds || !Array.isArray(definition.sounds)) continue;
        const custom = definition.sounds.slice(0, 64).map(value => typeof value === 'string' ? value : value?.type === 'event' ? null : value?.name).map(value => M.resource(value, 'sounds', '.ogg')).filter(path => files.has(path)).map(path => makeURL(files.get(path)));
        if (custom.length) { effects[name] = definition.replace ? custom : [...custom, ...effects[name]]; stats.sounds += custom.length; }
      }
      for (const track of Object.values(tracks)) { const path = keyFor.get(track.src); if (files.has(path)) { track.src = makeURL(files.get(path)); stats.sounds++; } }
      const panorama = [];
      for (let face = 0; face < 6; face++) { const result = await sprite(`assets/minecraft/textures/gui/title/background/panorama_${face}.png`); if (result) panorama.push(result.url); }
      bitmaps.forEach(value => value.close?.()); bitmaps.clear();
      return { info, stats, css, replacements, aliases, animations, animationSources, itemSources, gui, equipment, effects, tracks, panorama, dispose, hasButtons: css.has('--pack-button'), active: [...active] };
    } catch (error) { dispose(); throw error; }
  }

  async function drawModel(model, load, texture) {
    const faces = [], size = 96, view = [1, 1, -1];
    const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);
    const project = ([x, y, z]) => [(x + z) * .70710678, -y * .8660254 + (x - z) * .35355339, (x - z) * .61237244 + y * .5];
    function rotate(point, rotation, normal = false) {
      if (!rotation) return point;
      const origin = normal ? [0, 0, 0] : rotation.origin || [8, 8, 8], axis = { x: 0, y: 1, z: 2 }[rotation.axis], angle = Number(rotation.angle || 0) * Math.PI / 180;
      if (axis === undefined || !Number.isFinite(angle) || Math.abs(angle) > Math.PI / 4) throw Error();
      const p = point.map((n, i) => n - origin[i]), a = (axis + 1) % 3, b = (axis + 2) % 3;
      const x = p[a], y = p[b]; p[a] = x * Math.cos(angle) - y * Math.sin(angle); p[b] = x * Math.sin(angle) + y * Math.cos(angle);
      if (rotation.rescale && !normal) { p[a] /= Math.cos(angle); p[b] /= Math.cos(angle); }
      return p.map((n, i) => n + origin[i]);
    }
    for (const element of model.elements) {
      const a = element.from, b = element.to;
      if (![a, b].every(point => Array.isArray(point) && point.length === 3 && point.every(n => Number.isFinite(n) && n >= -16 && n <= 32))) throw Error();
      const [x0, y0, z0] = a, [x1, y1, z1] = b;
      const definitions = {
        north: [[[x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [x1, y0, z0]], [0, 0, -1], .65],
        south: [[[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]], [0, 0, 1], .65],
        east: [[[x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1]], [1, 0, 0], .82],
        west: [[[x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [x0, y0, z0]], [-1, 0, 0], .82],
        up: [[[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0], 1],
        down: [[[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]], [0, -1, 0], .6]
      };
      for (const [name, definition] of Object.entries(element.faces || {})) {
        const raw = definitions[name]; if (!raw || dot(rotate(raw[1], element.rotation, true), view) <= 0) continue;
        const source = await load(texture(definition.texture, model.textures)); if (!source) throw Error();
        const points = raw[0].map(point => project(rotate(point, element.rotation))), uv = definition.uv || [0, 0, 16, 16];
        if (!Array.isArray(uv) || uv.length !== 4 || uv.some(n => !Number.isFinite(n) || n < -16 || n > 32)) throw Error();
        faces.push({ points, uv, source, rotation: definition.rotation || 0, shade: element.shade === false ? 1 : raw[2], depth: points.reduce((sum, p) => sum + p[2], 0) / 4 });
      }
    }
    if (!faces.length) return null;
    const points = faces.flatMap(face => face.points), minX = Math.min(...points.map(p => p[0])), minY = Math.min(...points.map(p => p[1])), w = Math.max(...points.map(p => p[0])) - minX, h = Math.max(...points.map(p => p[1])) - minY;
    const scale = (size - 8) / Math.max(w, h); if (!Number.isFinite(scale)) return null;
    const output = canvas(size, size), context = output.getContext('2d'); context.imageSmoothingEnabled = false;
    for (const face of faces.sort((a, b) => a.depth - b.depth)) {
      const tile = canvas(64, 64), ctx = tile.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.translate(32, 32); ctx.rotate(face.rotation * Math.PI / 180);
      const [u, v, u1, v1] = face.uv, frameHeight = Math.min(face.source.height, face.source.width);
      ctx.drawImage(face.source, u / 16 * face.source.width, v / 16 * frameHeight, (u1 - u) / 16 * face.source.width, (v1 - v) / 16 * frameHeight, -32, -32, 64, 64);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(0,0,0,${1 - face.shade})`; ctx.fillRect(0, 0, 64, 64);
      const p = face.points.map(point => [(point[0] - minX) * scale + (size - w * scale) / 2, (point[1] - minY) * scale + (size - h * scale) / 2]);
      context.save(); context.setTransform((p[1][0] - p[0][0]) / 64, (p[1][1] - p[0][1]) / 64, (p[3][0] - p[0][0]) / 64, (p[3][1] - p[0][1]) / 64, p[0][0], p[0][1]); context.drawImage(tile, 0, 0); context.restore();
    }
    return output;
  }
  window.CraftPackRenderer = { base, originals, prepare };
})();
