(() => {
  const toast=document.querySelector('#toast');
  window.craftsideToast.onContent(data=>{
    if(data.hide){toast.classList.remove('visible');return;}
    document.querySelector('#title').textContent=data.title;document.querySelector('#heading').textContent=data.heading;
    if(data.icon)document.querySelector('#icon').src=data.icon;
    if(data.background)toast.style.backgroundImage=data.background;
    requestAnimationFrame(()=>requestAnimationFrame(()=>toast.classList.add('visible')));
  });
  document.querySelector('#open').onclick=()=>window.craftsideToast.action('open');
  document.querySelector('#close').onclick=()=>window.craftsideToast.action('close');
  toast.onpointerenter=()=>window.craftsideToast.action('enter');toast.onpointerleave=()=>window.craftsideToast.action('leave');
})();
