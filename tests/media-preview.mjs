import assert from 'node:assert/strict';
import {bindHoverPreview} from '../public/media-preview.js';
class Region{
  listeners=new Map();
  addEventListener(type,listener){this.listeners.set(type,listener);}
  removeEventListener(type){this.listeners.delete(type);}
  emit(type,pointerType='mouse'){this.listeners.get(type)?.({pointerType});}
}
const mediaFixture=()=>({paused:true,ended:false,loop:false,muted:true,currentTime:2,dataset:{},plays:0,pauses:0,play(){this.plays++;this.paused=false;return Promise.resolve();},pause(){this.pauses++;this.paused=true;}});
for(const kind of ['video','audio']){
  const region=new Region();const media=mediaFixture();const preview=bindHoverPreview(region,media);
  region.emit('pointerenter');await Promise.resolve();
  assert.equal(media.paused,false,`${kind}: hover starts playback`);assert.equal(media.loop,true);assert.equal(media.muted,true);
  region.emit('pointerleave');assert.equal(media.paused,true);assert.equal(media.loop,false);
  media.muted=false;region.emit('pointerenter');await Promise.resolve();assert.equal(media.muted,false,'the mute button choice is preserved');region.emit('pointerleave');
  media.ended=true;region.emit('pointerenter');await Promise.resolve();assert.equal(media.currentTime,0,'completed clips replay from the start');region.emit('pointerleave');
  const calls=media.plays;region.emit('pointerenter','touch');assert.equal(media.plays,calls,'touch input keeps manual player controls');
  media.ended=false;media.paused=false;region.emit('pointerenter');region.emit('pointerleave');assert.equal(media.paused,false,'manual playback already in progress is preserved');
  preview.dispose();assert.equal(region.listeners.size,0);
}
const region=new Region();const media=mediaFixture();let resolvePlay;
media.play=()=>{media.paused=false;return new Promise(resolve=>{resolvePlay=resolve;});};
const preview=bindHoverPreview(region,media);region.emit('pointerenter');region.emit('pointerleave');resolvePlay();await Promise.resolve();assert.equal(media.paused,true,'leaving before play resolves cannot restart playback');preview.dispose();
const blockedRegion=new Region();const blocked=mediaFixture();let reports=0;blocked.play=()=>Promise.reject(new Error('Autoplay blocked'));
bindHoverPreview(blockedRegion,blocked,{onBlocked:()=>reports++});blockedRegion.emit('pointerenter');await Promise.resolve();assert.equal(reports,1);assert.equal(blocked.loop,false);assert.equal(blocked.dataset.hoverPreview,undefined);
console.log('Video/audio hover play and pause, looping, mute choices, touch fallback, manual playback, cancellation, and autoplay rejection passed.');
