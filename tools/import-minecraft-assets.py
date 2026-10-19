"""Copy selected resource textures; never modify the game or supplied references."""
from pathlib import Path
from zipfile import ZipFile
from PIL import Image
from io import BytesIO
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'ref/VanillaTweaks_r106307_MC26.3.x.zip'
CLIENT = Path(r'C:\Users\Home\AppData\Roaming\.minecraft\versions\26.2\26.2.jar')
DEST = ROOT / 'assets/minecraft'
PREFIX = 'assets/minecraft/'
records = []
copied = {}

def digest(data):
    return hashlib.sha256(data).hexdigest()

with ZipFile(CLIENT) as base, ZipFile(PACK) as tweaks:
    base_names, tweak_names = set(base.namelist()), set(tweaks.namelist())
    language = json.loads(base.read(PREFIX + 'lang/en_us.json'))
    korean = json.loads(base.read(PREFIX + 'lang/ko_kr.json')) if PREFIX + 'lang/ko_kr.json' in base_names else {}
    # Additional languages live in the launcher's public asset object store.
    metadata_path = CLIENT.with_suffix('.json')
    if not korean and metadata_path.exists():
        index_id = json.loads(metadata_path.read_text(encoding='utf-8')).get('assetIndex', {}).get('id', '')
        asset_root = CLIENT.parents[2] / 'assets'
        if re.fullmatch(r'[a-zA-Z0-9_.-]+', index_id):
            index_path = asset_root / 'indexes' / (index_id + '.json')
            if index_path.exists():
                entry = json.loads(index_path.read_text(encoding='utf-8')).get('objects', {}).get('minecraft/lang/ko_kr.json', {})
                object_hash = entry.get('hash', '')
                if re.fullmatch(r'[a-f0-9]{40}', object_hash):
                    language_path = asset_root / 'objects' / object_hash[:2] / object_hash
                    if language_path.exists():
                        data = language_path.read_bytes()
                        if hashlib.sha1(data).hexdigest() != object_hash:
                            raise ValueError('Minecraft language asset hash mismatch')
                        korean = json.loads(data)
                        target = DEST / 'lang/ko_kr.json'
                        target.parent.mkdir(parents=True, exist_ok=True)
                        target.write_bytes(data)
                        records.append({'path': 'assets/minecraft/lang/ko_kr.json', 'source': 'Minecraft language asset', 'entry': 'minecraft/lang/ko_kr.json', 'assetIndex': index_id, 'sha256': digest(data)})
    local_names = {'compass': '나침반', 'painting': '그림', 'map': '지도', 'redstone': '레드스톤 가루', 'emerald': '에메랄드',
                   'ominous_bottle': '불길한 병', 'writable_book': '책과 깃펜', 'cyan_dye': '청록색 염료', 'nether_star': '네더의 별',
                   'barrier': '방벽', 'crafting_table': '제작대', 'stone_axe': '돌 도끼', 'diamond_pickaxe': '다이아몬드 곡괭이',
                   'minecart': '광산 수레', 'book': '책', 'shears': '가위', 'diamond': '다이아몬드', 'iron_sword': '철 검',
                   'apple': '사과', 'stone': '돌', 'dirt': '흙', 'oak_planks': '참나무 판자', 'chest': '상자', 'amethyst_shard': '자수정 조각'}

    def copy(relative):
        if relative in copied:
            return copied[relative]
        source_name = PREFIX + relative
        archive, source = (tweaks, 'VanillaTweaks') if source_name in tweak_names else (base, 'Minecraft 26.2')
        if not re.fullmatch(r'[a-z0-9_/.-]+', relative):
            raise ValueError(relative)
        data = archive.read(source_name)
        target = DEST / relative
        assert target.resolve().is_relative_to(DEST.resolve())
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        records.append({'path': str(target.relative_to(ROOT)).replace('\\', '/'), 'source': source, 'entry': source_name, 'sha256': digest(data)})
        copied[relative] = '../assets/minecraft/' + relative
        return copied[relative]

    def category(item_id, armor=None):
        if armor:
            return 'equipment'
        if any(word in item_id for word in ['sword', 'bow', 'trident', 'mace', 'shield', '_spear']) or item_id.endswith('_armor'):
            return 'equipment'
        if any(word in item_id for word in ['pickaxe', '_axe', '_hoe', 'shovel', 'shears', 'compass', 'clock', 'fishing_rod', 'brush', 'spyglass', 'flint_and_steel', 'bucket']):
            return 'tools'
        foods = {'apple', 'golden_apple', 'enchanted_golden_apple', 'bread', 'beef', 'cooked_beef', 'porkchop', 'cooked_porkchop',
                 'chicken', 'cooked_chicken', 'mutton', 'cooked_mutton', 'rabbit', 'cooked_rabbit', 'cod', 'cooked_cod', 'salmon',
                 'cooked_salmon', 'tropical_fish', 'pufferfish', 'potato', 'baked_potato', 'poisonous_potato', 'carrot', 'golden_carrot',
                 'cookie', 'melon_slice', 'sweet_berries', 'glow_berries', 'mushroom_stew', 'rabbit_stew', 'suspicious_stew',
                 'beetroot_soup', 'beetroot', 'honey_bottle', 'pumpkin_pie', 'rotten_flesh', 'chorus_fruit', 'dried_kelp'}
        if item_id in foods:
            return 'food'
        if any(word in item_id for word in ['minecart', 'boat', 'raft', 'rail', 'saddle', 'elytra', 'redstone', 'repeater', 'comparator', 'hopper', 'piston', 'lever']):
            return 'transport'
        return 'materials'

    def catalog_item(item_id, src, armor=None, group=None):
        return {'id': item_id, 'name': language.get('item.minecraft.' + item_id, language.get('block.minecraft.' + item_id, item_id.replace('_', ' ').title())),
                'nameKo': local_names.get(item_id, korean.get('item.minecraft.' + item_id, korean.get('block.minecraft.' + item_id, ''))),
                'src': src, 'armor': armor, 'category': group or category(item_id, armor)}

    gui = {}
    wanted_gui = {
        'inventory': 'textures/gui/container/inventory.png',
        'hotbar': 'textures/gui/sprites/hud/hotbar.png',
        'selection': 'textures/gui/sprites/hud/hotbar_selection.png',
        'button': 'textures/gui/sprites/widget/button.png',
        'buttonHover': 'textures/gui/sprites/widget/button_highlighted.png',
        'buttonDisabled': 'textures/gui/sprites/widget/button_disabled.png',
        'panorama': 'textures/gui/title/background/panorama_0.png',
        'helmetSlot': 'textures/gui/sprites/container/slot/helmet.png',
        'chestSlot': 'textures/gui/sprites/container/slot/chestplate.png',
        'legsSlot': 'textures/gui/sprites/container/slot/leggings.png',
        'feetSlot': 'textures/gui/sprites/container/slot/boots.png',
        'shieldSlot': 'textures/gui/sprites/container/slot/shield.png',
        'creativeSearch': 'textures/gui/container/creative_inventory/tab_item_search.png',
        'creativeScroller': 'textures/gui/sprites/container/creative_inventory/scroller.png',
        'creativeTab': 'textures/gui/sprites/container/creative_inventory/tab_top_unselected_2.png',
        'creativeTabSelected': 'textures/gui/sprites/container/creative_inventory/tab_top_selected_2.png'
    }
    for key, relative in wanted_gui.items():
        gui[key] = copy(relative)
    for i in range(1, 4):
        copy(f'textures/gui/title/background/panorama_{i}.png')

    materials = ['chainmail', 'copper', 'diamond', 'gold', 'iron', 'netherite', 'turtle_scute']
    equipment = {}
    for material in materials:
        equipment[material] = {'outer': copy(f'textures/entity/equipment/humanoid/{material}.png')}
        relative = f'textures/entity/equipment/humanoid_leggings/{material}.png'
        if PREFIX + relative in base_names or PREFIX + relative in tweak_names:
            equipment[material]['legs'] = copy(relative)

    items = []
    ids = sorted(Path(n).stem for n in base_names if n.startswith(PREFIX + 'items/') and n.endswith('.json') and '/' not in n[len(PREFIX + 'items/'):])
    for item_id in ids:
        relative = f'textures/item/{item_id}.png'
        name = PREFIX + relative
        if name not in base_names and name not in tweak_names:
            continue
        if item_id.startswith('leather_') or any(word in item_id for word in ['spawn_egg', 'potion', 'tipped_arrow', 'firework_star', 'filled_map']):
            continue  # These require additional tint/model layers, not a flat item sprite.
        archive = tweaks if name in tweak_names else base
        width, height = Image.open(BytesIO(archive.read(name))).size
        if width != height or width > 64:
            continue
        armor = None
        match = re.fullmatch(r'(chainmail|copper|diamond|golden|iron|netherite)_(helmet|chestplate|leggings|boots)', item_id)
        if match:
            material, part = match.groups()
            armor = {'material': 'gold' if material == 'golden' else material, 'slot': {'helmet': 'head', 'chestplate': 'chest', 'leggings': 'legs', 'boots': 'feet'}[part]}
        if item_id == 'turtle_helmet':
            armor = {'material': 'turtle_scute', 'slot': 'head'}
        items.append(catalog_item(item_id, copy(relative), armor))

    # Compass is a range-dispatch model. Use its actual north-pointing frame.
    items.append(catalog_item('compass', copy('textures/item/compass_16.png')))

    def read_model(name, stack=()):
        name = name.replace('minecraft:', '')
        if name in stack:
            raise ValueError('Cyclic model')
        model = json.loads(base.read(PREFIX + 'models/' + name + '.json'))
        result = read_model(model['parent'], stack + (name,)) if 'parent' in model else {}
        result['textures'] = {**result.get('textures', {}), **model.get('textures', {})}
        if 'elements' in model:
            result['elements'] = model['elements']
        return result

    def render_cube(item_id, model, model_name):
        elements = model.get('elements', [])
        if len(elements) != 1 or elements[0].get('from') != [0, 0, 0] or elements[0].get('to') != [16, 16, 16]:
            return None  # Only genuine full-cube models, not invented silhouettes.
        faces, textures = elements[0]['faces'], model.get('textures', {})
        paths = []
        output = Image.new('RGBA', (32, 32))
        # Orthographic projection of the vanilla cube GUI view. Nearest texels,
        # top / north / east face shading, with no antialiasing or AI artwork.
        projections = [
            ('up', (16, 2), (13, 7), (-13, 7), 1.0),
            ('north', (3, 9), (13, 7), (0, 15), .62),
            ('east', (16, 16), (13, -7), (0, 15), .82)
        ]
        for face, origin, du, dv, shade in projections:
            definition = faces.get(face, {})
            if not definition or 'tintindex' in definition or definition.get('rotation', 0) or definition.get('uv', [0, 0, 16, 16]) != [0, 0, 16, 16]:
                return None
            name = definition['texture']
            for _ in range(12):
                if not isinstance(name, str):
                    return None
                if not name.startswith('#'):
                    break
                name = textures[name[1:]]
            if not isinstance(name, str) or name.startswith('#'):
                return None
            relative = 'textures/' + name.replace('minecraft:', '') + '.png'
            full_name = PREFIX + relative
            archive = tweaks if full_name in tweak_names else base
            texture = Image.open(BytesIO(archive.read(full_name))).convert('RGBA')
            if texture.size != (16, 16):
                return None
            paths.append(relative)
            # Inverse affine lookup at output pixel centers avoids polygon seams.
            determinant = du[0] * dv[1] - du[1] * dv[0]
            for y in range(32):
                for x in range(32):
                    dx, dy = x + .5 - origin[0], y + .5 - origin[1]
                    u = (dx * dv[1] - dy * dv[0]) / determinant
                    v = (du[0] * dy - du[1] * dx) / determinant
                    if 0 <= u < 1 and 0 <= v < 1:
                        rgba = texture.getpixel((int(u * 16), int(v * 16)))
                        output.putpixel((x, y), tuple(round(c * shade) for c in rgba[:3]) + (rgba[3],))
        for path in set(paths):
            copy(path)
        relative = 'renders/' + item_id + '.png'
        target = DEST / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        output.save(target)
        records.append({'path': str(target.relative_to(ROOT)).replace('\\', '/'), 'source': 'Minecraft model render',
                        'entry': 'models/' + model_name.replace('minecraft:', '') + '.json', 'inputs': sorted(set(paths)), 'sha256': digest(target.read_bytes())})
        return '../assets/minecraft/' + relative

    existing = {item['id'] for item in items}
    for item_id in ids:
        if item_id in existing:
            continue
        definition = json.loads(base.read(PREFIX + 'items/' + item_id + '.json')).get('model', {})
        model_name = definition.get('model', '')
        if definition.get('type') != 'minecraft:model' or not model_name.startswith('minecraft:block/'):
            continue
        try:
            src = render_cube(item_id, read_model(model_name), model_name)
        except (KeyError, ValueError):
            continue
        if src:
            items.append(catalog_item(item_id, src, group='blocks'))

skin = ROOT / 'ref/ARU_Tris.png'
skin_target = ROOT / 'assets/player/ARU_Tris.png'
skin_target.parent.mkdir(parents=True, exist_ok=True)
skin_target.write_bytes(skin.read_bytes())
records.append({'path': 'assets/player/ARU_Tris.png', 'source': 'User reference', 'entry': 'ref/ARU_Tris.png', 'sha256': digest(skin.read_bytes())})
catalog = {'gui': gui, 'equipment': equipment, 'items': items, 'defaultSkin': '../assets/player/ARU_Tris.png'}
(DEST / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(DEST / 'catalog.js').write_text('window.CraftAssets = ' + json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
manifest = {'pack': {'path': str(PACK), 'sha256': digest(PACK.read_bytes())}, 'base': {'path': str(CLIENT), 'sha256': digest(CLIENT.read_bytes())}, 'skin': {'path': str(skin), 'sha256': digest(skin.read_bytes())}, 'files': records}
(DEST / 'sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'items': len(items), 'armorItems': sum(bool(i['armor']) for i in items), 'copiedFiles': len(records), 'VanillaTweaksFiles': sum(r['source'] == 'VanillaTweaks' for r in records), 'gameFilesModified': False}))
