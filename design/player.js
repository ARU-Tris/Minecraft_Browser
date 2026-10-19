(() => {
  'use strict';
  const KEY = 'craftside:player:v2';
  let skin, model = 'classic', outer = true, yaw = -.35;
  const Pose = window.CraftPlayerPose, poses = new WeakMap();
  const poseFor = canvas => {
    if (!poses.has(canvas)) poses.set(canvas, { current: Pose.neutral(), target: Pose.neutral() });
    return poses.get(canvas);
  };
  let skinLabel = 'ARU_Tris.png', savedData = null, preset = 'aru_tris', loadRevision = 0;
  let equipped = { head: null, chest: null, legs: null, feet: null };
  const equipmentImages = new Map();
  const faceTextures=new WeakMap(),drawStates=new WeakMap(),avatarStates=new WeakMap();let equipmentVersion=0;
  let defaultImage = null;
  const $ = selector => document.querySelector(selector);
  const atlasRects = (u, v, w, h, d) => ({
    top: [u+d,v,w,d], bottom: [u+d+w,v,w,d], left: [u,v+d,d,h],
    front: [u+d,v+d,w,h], right: [u+d+w,v+d,d,h], back: [u+2*d+w,v+d,w,h]
  });
  function rotate([x,y,z], angle) { return [x*Math.cos(angle)+z*Math.sin(angle),y,-x*Math.sin(angle)+z*Math.cos(angle)]; }
  function drawPlayer(canvas) {
    if (!skin || !canvas.getClientRects().length) return;
    const ctx=canvas.getContext('2d'), width=canvas.width, height=canvas.height;
    const look = canvas.hasAttribute('data-skin-only') ? Pose.neutral() : poseFor(canvas).current;
    const bodyAngle = yaw + look.bodyYaw, headYaw = look.headYaw, headPitch = look.headPitch;
    const stamp=[width,height,model,outer,skinLabel,yaw.toFixed(6),look.bodyYaw.toFixed(6),headYaw.toFixed(6),headPitch.toFixed(6),equipmentVersion,...Object.values(equipped).map(item=>item?.material||'')].join('|');
    const previous=drawStates.get(canvas);if(previous?.skin===skin&&previous.stamp===stamp)return;drawStates.set(canvas,{skin,stamp});
    ctx.clearRect(0,0,width,height);ctx.imageSmoothingEnabled=false;
    const scale=Math.min(width/23,height/37), origin=[width/2,height-15], pitch=.11, faces=[];
    const project=point=>{const [x,y,z]=rotate(point,bodyAngle);return [origin[0]+x*scale,origin[1]-(y*Math.cos(pitch)-z*Math.sin(pitch))*scale,y*Math.sin(pitch)+z*Math.cos(pitch)];};
    function box(cx,bottom,w,h,d,u,v,inflate=0,mirror=false,isHead=false,texture=skin) {
      const x0=cx-w/2-inflate,x1=cx+w/2+inflate,y0=bottom-inflate,y1=bottom+h+inflate,z0=-d/2-inflate,z1=d/2+inflate;
      const rects=atlasRects(u,v,w,h,d);
      const raw=[
        ['front',[[x0,y1,z1],[x1,y1,z1],[x1,y0,z1],[x0,y0,z1]],[0,0,1],1],
        ['back',[[x1,y1,z0],[x0,y1,z0],[x0,y0,z0],[x1,y0,z0]],[0,0,-1],.74],
        ['left',[[x0,y1,z0],[x0,y1,z1],[x0,y0,z1],[x0,y0,z0]],[-1,0,0],.7],
        ['right',[[x1,y1,z1],[x1,y1,z0],[x1,y0,z0],[x1,y0,z1]],[1,0,0],.82],
        ['top',[[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],[0,1,0],1],
        ['bottom',[[x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0]],[0,-1,0],.6]
      ];
      for (let [name,vertices,normal,light] of raw) {
        if (isHead) {
          vertices=vertices.map(([x,y,z])=>{const p=rotate([x,y-28,z],headYaw);return [p[0],p[1]*Math.cos(headPitch)-p[2]*Math.sin(headPitch)+28,p[1]*Math.sin(headPitch)+p[2]*Math.cos(headPitch)];});
          normal=rotate(normal,headYaw);normal=[normal[0],normal[1]*Math.cos(headPitch)-normal[2]*Math.sin(headPitch),normal[1]*Math.sin(headPitch)+normal[2]*Math.cos(headPitch)];
        }
        const n=rotate(normal,bodyAngle);if(n[1]*Math.sin(pitch)+n[2]*Math.cos(pitch)<=0)continue;
        const points=vertices.map(project);
        const mappedFace=mirror&&name==='left'?'right':mirror&&name==='right'?'left':name;
        faces.push({points,rect:rects[mappedFace],depth:points.reduce((sum,p)=>sum+p[2],0)/4,light,mirror,texture});
      }
    }
    const legacy=skin.height===32, armWidth=model==='slim'?3:4;
    box(0,24,8,8,8,0,0,0,false,true);box(0,12,8,12,4,16,16);
    box(-4-armWidth/2,12,armWidth,12,4,40,16);box(4+armWidth/2,12,armWidth,12,4,legacy?40:32,legacy?16:48,0,legacy);
    box(-2,0,4,12,4,0,16);box(2,0,4,12,4,legacy?0:16,legacy?16:48,0,legacy);
    if(outer){box(0,24,8,8,8,32,0,.45,false,true);if(!legacy){box(0,12,8,12,4,16,32,.25);box(-4-armWidth/2,12,armWidth,12,4,40,32,.25);box(4+armWidth/2,12,armWidth,12,4,48,48,.25);box(-2,0,4,12,4,0,32,.25);box(2,0,4,12,4,0,48,.25);}}
    const armorTexture = (part, layer = 'outer') => {
      if (canvas.hasAttribute('data-skin-only')) return null;
      const material = equipped[part]?.material;
      const image = material ? equipmentImages.get(material + ':' + layer) : null;
      return image?.complete && image.naturalWidth ? image : null;
    };
    let armor = armorTexture('head');
    if (armor) box(0,24,8,8,8,0,0,1,false,true,armor);
    armor = armorTexture('chest');
    if (armor) { box(0,12,8,12,4,16,16,1,false,false,armor);box(-4-armWidth/2,12,4,12,4,40,16,1,false,false,armor);box(4+armWidth/2,12,4,12,4,40,16,1,true,false,armor); }
    armor = armorTexture('legs', 'legs');
    if (armor) { box(0,12,8,12,4,16,16,.45,false,false,armor);box(-2,0,4,12,4,0,16,.45,false,false,armor);box(2,0,4,12,4,0,16,.45,true,false,armor); }
    armor = armorTexture('feet');
    if (armor) { box(-2,0,4,12,4,0,16,1,false,false,armor);box(2,0,4,12,4,0,16,1,true,false,armor); }
    ctx.fillStyle='#0006';ctx.beginPath();ctx.ellipse(width/2,height-12,scale*7,scale*1.2,0,0,Math.PI*2);ctx.fill();
    faces.sort((a,b)=>a.depth-b.depth);
    for(const face of faces){
      const [p0,p1,,p3]=face.points,[sx,sy,sw,sh]=face.rect;
      let cache=faceTextures.get(face.texture);if(!cache){cache=new Map();faceTextures.set(face.texture,cache);}
      const tileKey=[sx,sy,sw,sh,face.light].join(',');let tile=cache.get(tileKey);
      if(!tile){tile=document.createElement('canvas');tile.width=sw;tile.height=sh;const textureScale=face.texture.width/64;
        const t=tile.getContext('2d');t.imageSmoothingEnabled=false;t.drawImage(face.texture,sx*textureScale,sy*textureScale,sw*textureScale,sh*textureScale,0,0,sw,sh);
        t.globalCompositeOperation='source-atop';t.fillStyle=`rgba(0,0,0,${1-face.light})`;t.fillRect(0,0,sw,sh);cache.set(tileKey,tile);}
      ctx.save();ctx.setTransform((p1[0]-p0[0])/sw,(p1[1]-p0[1])/sw,(p3[0]-p0[0])/sh,(p3[1]-p0[1])/sh,p0[0],p0[1]);
      if(face.mirror){ctx.translate(sw,0);ctx.scale(-1,1);}ctx.drawImage(tile,0,0);ctx.restore();
    }
    canvas.dataset.skin=skinLabel;canvas.dataset.model=model;canvas.dataset.yaw=String(Math.round(yaw*180/Math.PI));
    canvas.dataset.bodyYaw=look.bodyYaw.toFixed(4);canvas.dataset.headYaw=headYaw.toFixed(4);canvas.dataset.headPitch=headPitch.toFixed(4);
    canvas.dataset.equipment=JSON.stringify(equipped);
    canvas.dataset.ready=String(Boolean(savedData || defaultImage));
  }
  function refresh() {
    document.querySelectorAll('[data-player-canvas]').forEach(drawPlayer);
    document.querySelectorAll('[data-player-face]').forEach(canvas=>{
      if(!canvas.getClientRects().length)return;
      const previous=avatarStates.get(canvas);if(previous?.skin===skin&&previous.outer===outer)return;avatarStates.set(canvas,{skin,outer});
      const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(skin,8,8,8,8,0,0,canvas.width,canvas.height);if(outer)ctx.drawImage(skin,40,8,8,8,0,0,canvas.width,canvas.height);
    });
    if(!$('#skin-description').hasAttribute('data-user-content'))$('#skin-description').setAttribute('data-user-content','');if($('#skin-description').textContent!==skinLabel)$('#skin-description').textContent=skinLabel;$('#skin-model').value=model;$('#skin-layer').checked=outer;$('#skin-rotation').value=String(Math.round(yaw*180/Math.PI));
  }
  function save() {
    try{localStorage.setItem(KEY,JSON.stringify({data:savedData,preset,model,outer,label:skinLabel}));return true;}
    catch{$('#skin-error').textContent='스킨은 적용했지만 이 환경에서는 다음 방문을 위해 저장할 수 없습니다.';$('#skin-error').hidden=false;return false;}
  }
  async function useDefault() {
    const revision = ++loadRevision;
    try {
      if (!defaultImage) { const image = new Image();image.src=window.CraftAssets.defaultSkin;await image.decode();defaultImage=image; }
      if (revision !== loadRevision) return;
      preset='aru_tris';savedData=null;skin=defaultImage;model='classic';outer=true;yaw=-.35;resetLook(true);skinLabel='ARU_Tris.png';
      $('#skin-error').hidden=true;refresh();save();
    } catch { $('#skin-error').textContent='ARU_Tris 스킨을 불러오지 못했습니다.';$('#skin-error').hidden=false; }
  }
  async function loadFile(file) {
    const revision=++loadRevision;$('#skin-error').hidden=true;if(!file)return;
    try{
      if(file.size>2*1024*1024)throw Error('스킨은 2MB 이하의 PNG 파일로 골라주세요.');
      const magic=new Uint8Array(await file.slice(0,8).arrayBuffer());
      if(![137,80,78,71,13,10,26,10].every((byte,i)=>magic[i]===byte))throw Error('PNG 형식의 스킨 파일을 골라주세요.');
      const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('파일을 읽지 못했습니다.'));reader.readAsDataURL(file);});
      const data=String(source).replace(/^data:[^;]*;base64,/, 'data:image/png;base64,');
      const image=new Image();image.src=data;await image.decode();
      if(image.width!==64||![32,64].includes(image.height))throw Error('64×64 또는 64×32 픽셀의 스킨 PNG를 골라주세요.');
      if(revision!==loadRevision)return;
      skin=image;savedData=data;preset=null;skinLabel=file.name;if(image.height===32)model='classic';refresh();save();
      document.dispatchEvent(new CustomEvent('craftside:skin-loaded',{detail:{width:image.width,height:image.height}}));
    }catch(error){if(revision!==loadRevision)return;$('#skin-error').textContent=error.message||'스킨을 불러오지 못했습니다.';$('#skin-error').hidden=false;}
  }
  skin=document.createElement('canvas');skin.width=skin.height=64;
  $('#choose-skin').addEventListener('click',()=>$('#skin-file').click());
  $('#skin-file').addEventListener('change',event=>{loadFile(event.target.files[0]);event.target.value='';});
  $('#skin-model').addEventListener('change',event=>{
    if(skin.height===32&&event.target.value==='slim'){event.target.value='classic';$('#skin-error').textContent='64×32 스킨은 클래식 체형으로 표시합니다.';$('#skin-error').hidden=false;return;}
    model=event.target.value;refresh();save();
  });
  $('#skin-layer').addEventListener('change',event=>{outer=event.target.checked;refresh();save();});
  $('#skin-rotation').addEventListener('input',event=>{yaw=Number(event.target.value)*Math.PI/180;resetLook(true);refresh();});
  $('#reset-skin').addEventListener('click',useDefault);
  let pointer=null, frame=null, lastFrame=null;
  function resetLook(immediate = false) {
    document.querySelectorAll('[data-player-canvas]').forEach(canvas => {
      const pose = poseFor(canvas); pose.target = Pose.neutral(); if (immediate) pose.current = Pose.neutral();
    });
  }
  function animate(time) {
    const seconds = lastFrame === null ? 1 / 60 : (time - lastFrame) / 1000; lastFrame = time;
    let moving = false;
    document.querySelectorAll('.inventory-native [data-player-canvas]').forEach(canvas => {
      if(!canvas.getClientRects().length)return;
      const pose = poseFor(canvas); pose.current = Pose.advance(pose.current, pose.target, seconds);
      moving ||= !Pose.settled(pose.current, pose.target);
    });
    document.querySelectorAll('.inventory-native [data-player-canvas]').forEach(drawPlayer);
    if (moving) frame = requestAnimationFrame(animate); else { frame = null; lastFrame = null; }
  }
  const schedule=()=>{if(frame===null&&!document.hidden)frame=requestAnimationFrame(animate);};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(frame!==null)cancelAnimationFrame(frame);frame=null;lastFrame=null;}else{refresh();schedule();}});
  document.addEventListener('pointerdown',event=>{if(event.target.matches('[data-player-canvas]')){resetLook(true);pointer={id:event.pointerId,x:event.clientX,yaw,target:event.target};event.target.setPointerCapture(event.pointerId);schedule();}});
  document.addEventListener('pointermove',event=>{
    if(pointer&&pointer.id===event.pointerId){yaw=pointer.yaw+(event.clientX-pointer.x)*.018;yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));schedule();}
    else if (event.target.closest('#browser-shell') && !document.querySelector('dialog[open]')) {
      document.querySelectorAll('.inventory-native [data-player-canvas]').forEach(canvas => {
        const bounds = canvas.getBoundingClientRect(); if (!bounds.width || !bounds.height) return;
        poseFor(canvas).target = Pose.target(event.clientX, event.clientY, bounds);
      });
      schedule();
    } else { resetLook(); schedule(); }
  });
  document.addEventListener('pointerout',event=>{if(!event.relatedTarget){resetLook();schedule();}});
  $('#browser-shell').addEventListener('pointerleave',()=>{if(!pointer){resetLook();schedule();}});
  window.addEventListener('blur',()=>{resetLook();schedule();});
  const release=event=>{if(pointer&&pointer.id===event.pointerId){if(pointer.target.hasPointerCapture(event.pointerId))pointer.target.releasePointerCapture(event.pointerId);pointer=null;}};
  document.addEventListener('pointerup',release);document.addEventListener('pointercancel',release);
  function setEquipment(selection) {
    equipped = Object.fromEntries(['head','chest','legs','feet'].map(part => [part, selection[part] || null]));
    for (const entry of Object.values(equipped)) {
      if (!entry) continue;
      const sources = window.CraftAssets.equipment[entry.material];
      if (!sources) continue;
      for (const [layer, src] of Object.entries(sources)) {
        const key = entry.material + ':' + layer;
        if (equipmentImages.get(key)?.src === new URL(src, document.baseURI).href) continue;
        const image = new Image();equipmentImages.set(key,image);image.src=src;
        image.decode().then(()=>{equipmentVersion++;refresh();}).catch(() => { $('#skin-error').textContent='갑옷 텍스처를 불러오지 못했습니다.';$('#skin-error').hidden=false; });
      }
    }
    refresh();
  }
  window.CraftPlayer={refresh,setEquipment,reloadResources(){equipmentVersion++;equipmentImages.clear();setEquipment(equipped);}};refresh();
  (async()=>{
    try{
      const revision=loadRevision;
      const original = new Image();original.src=window.CraftAssets.defaultSkin;await original.decode();defaultImage=original;
      if (revision !== loadRevision) return;
      skin=original;
      let saved=null;
      try { saved=JSON.parse(localStorage.getItem(KEY)||'null'); } catch { /* The supplied skin still works if preferences are unavailable. */ }
      if(!saved){refresh();return;}
      if(saved.data&&/^data:image\/png;base64,/.test(saved.data)&&saved.data.length<3*1024*1024){
        const image=new Image();image.src=saved.data;await image.decode();if(revision!==loadRevision||image.width!==64||![32,64].includes(image.height))return;
        skin=image;savedData=saved.data;preset=null;skinLabel=String(saved.label||'내 스킨');
      }else {preset='aru_tris';skin=original;skinLabel='ARU_Tris.png';}
      model=skin.height===32?'classic':saved.model==='slim'?'slim':'classic';outer=saved.outer!==false;refresh();
    }catch{/* Invalid or unavailable preferences leave the default player available. */}
  })();
})();
