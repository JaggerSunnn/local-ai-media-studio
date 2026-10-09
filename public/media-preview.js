// Pointer previews never change the user's mute setting or start on touch input.
export function bindHoverPreview(region,media,{onBlocked=()=>{}}={}){
  let inside=false,ownsPlayback=false,epoch=0,originalLoop=media.loop;
  const stop=()=>{
    inside=false;epoch++;
    if(ownsPlayback){media.pause();media.loop=originalLoop;}
    ownsPlayback=false;delete media.dataset.hoverPreview;
  };
  const start=async()=>{
    if(inside)return;
    inside=true;const token=++epoch;
    if(!media.paused&&!media.ended)return;
    ownsPlayback=true;originalLoop=media.loop;media.loop=true;media.dataset.hoverPreview='active';
    if(media.ended)media.currentTime=0;
    try{
      await media.play();
      if(!inside)media.pause();
    }catch{
      if(inside&&token===epoch){ownsPlayback=false;media.loop=originalLoop;delete media.dataset.hoverPreview;onBlocked();}
    }
  };
  const enter=event=>{if(event.pointerType==='mouse')start();};
  const leave=event=>{if(event.pointerType==='mouse')stop();};
  region.addEventListener('pointerenter',enter);region.addEventListener('pointerleave',leave);
  return {start,stop,dispose(){stop();region.removeEventListener('pointerenter',enter);region.removeEventListener('pointerleave',leave);}};
}
