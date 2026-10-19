"""Build browser lookup data from project copies and public client models only."""
from pathlib import Path
import json
import zipfile
import hashlib

ROOT = Path(__file__).resolve().parent.parent


def main():
    source = json.loads((ROOT / 'assets/minecraft/sources.json').read_text(encoding='utf-8'))
    catalog = json.loads((ROOT / 'assets/minecraft/catalog.json').read_text(encoding='utf-8'))
    jar_hash = hashlib.sha256(Path(source['base']['path']).read_bytes()).hexdigest()
    if jar_hash != source['base']['sha256']:
        raise ValueError('The public client archive differs from the recorded source')
    bindings, blocks, models, definitions = {}, {}, {}, {}
    for row in source['files']:
        relative, entry = row['path'], row['entry']
        if entry.startswith('assets/minecraft/textures/') or entry.startswith('textures/'):
            bindings['../' + relative] = entry if entry.startswith('assets/') else 'assets/minecraft/' + entry
        elif row['source'] == 'Minecraft model render':
            blocks[Path(relative).stem] = 'minecraft:' + entry.removeprefix('models/').removesuffix('.json')
    media = json.loads((ROOT / 'assets/ambience/sources.json').read_text(encoding='utf-8'))
    for row in media:
        if '/sounds/' in row.get('entry', ''):
            bindings['../' + row['path']] = 'assets/' + row['entry']
    bindings['../assets/notifications/enchanted_glint_item.png'] = 'assets/minecraft/textures/misc/enchanted_glint_item.png'
    with zipfile.ZipFile(source['base']['path']) as archive:
        version = json.loads(archive.read('version.json'))
        def model(name):
            name = name if ':' in name else 'minecraft:' + name
            if name in models or name in ('minecraft:item/generated', 'minecraft:item/handheld', 'minecraft:builtin/generated', 'minecraft:builtin/entity'):
                return
            namespace, path = name.split(':', 1)
            entry = f'assets/{namespace}/models/{path}.json'
            try:
                data = json.loads(archive.read(entry))
            except KeyError:
                return
            models[name] = data
            if 'parent' in data:
                model(data['parent'])
        for item in catalog['items']:
            name = item['id']
            try:
                data = json.loads(archive.read(f'assets/minecraft/items/{name}.json'))
                definitions[name] = data
                if data.get('model', {}).get('type') == 'minecraft:model':
                    model(data['model']['model'])
            except KeyError:
                pass
        for name in blocks.values():
            model(name)
    data = {'schema': 1, 'format': [version['pack_version']['resource_major'], version['pack_version']['resource_minor']],
            'version': version['id'], 'bindings': bindings, 'blocks': blocks, 'models': models, 'items': definitions}
    target = ROOT / 'assets/resource-base.json'
    target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    provenance = {'path': target.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                  'source': source['base']['path'], 'sourceSha256': jar_hash, 'version': version['id'], 'format': data['format'],
                  'models': len(models), 'scope': 'Public client item/model JSON and existing project asset bindings. No game account/settings/save/mod files read or modified.'}
    (ROOT / 'assets/resource-base.sources.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'baseVersion': version['id'], 'bindings': len(bindings), 'models': len(models), 'blockIcons': len(blocks), 'bytes': target.stat().st_size}))


if __name__ == '__main__':
    main()
