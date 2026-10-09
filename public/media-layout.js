export function mediaLayout(kind,options={},dimensions={}){
  let ratio;
  const width=Number(dimensions.width),height=Number(dimensions.height);
  if(Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0)ratio=width/height;
  if(!ratio){
    const w=Number(options.width),h=Number(options.height);
    if(Number.isFinite(w)&&Number.isFinite(h)&&w>0&&h>0)ratio=w/h;
  }
  if(!ratio){
    const match=String(options.aspectRatio||options.ratio||'').match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
    if(match&&Number(match[1])>0&&Number(match[2])>0)ratio=Number(match[1])/Number(match[2]);
  }
  if(!Number.isFinite(ratio)||ratio<=0)ratio=kind==='image'?1:16/9;
  const shape=ratio>1.2?'landscape':ratio<.85?'portrait':'square';
  return {ratio,shape,band:shape==='landscape'?'wide':'standard',columns:shape==='landscape'?2:3};
}

// Rearrange existing nodes so previews, focus, and batch identity are retained.
export function arrangeRatioBands(container){
  const cards=[...container.querySelectorAll('.comparison-card')].sort((a,b)=>Number(a.dataset.cardOrder)-Number(b.dataset.cardOrder));
  const bands=new Map();
  for(const card of cards){
    const name=card.dataset.layoutBand||'standard';
    let band=bands.get(name);
    if(!band){band=[...container.children].find(node=>node.dataset?.ratioBand===name);if(!band){band=document.createElement('div');band.className=`result-band ${name}`;band.dataset.ratioBand=name;}bands.set(name,band);}
    const position=cards.filter(item=>(item.dataset.layoutBand||'standard')===name).indexOf(card);
    if(band.children[position]!==card)band.insertBefore(card,band.children[position]||null);
  }
  let position=0;
  for(const band of bands.values()){if(container.children[position]!==band)container.insertBefore(band,container.children[position]||null);position++;}
  for(const child of [...container.children])if(!bands.has(child.dataset?.ratioBand))child.remove();
}
