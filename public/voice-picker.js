import {languageLabel} from './languages.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function filterVoices(voices,{type,language='all',gender='all',search=''}){
  const query=search.trim().toLowerCase();
  return voices.filter(voice=>voice.type===type&&(language==='all'||voice.languageCode===language||voice.language==='Multilingual')&&(gender==='all'||voice.timbre===gender)&&`${voice.name} ${voice.id} ${voice.language}`.toLowerCase().includes(query));
}
export function createVoicePicker({api,onSelect,onData,toast}){
  const dialog=document.querySelector('#voiceDialog');
  const list=document.querySelector('#voiceList');
  const search=document.querySelector('#voiceSearch');
  const language=document.querySelector('#voiceLanguage');
  const gender=document.querySelector('#voiceGender');
  const status=document.querySelector('#voiceStatus');
  let catalog=null,context=null,audio=null,playingId=null,loadingId=null;
  function stop(){if(audio){audio.pause();audio.src='';audio=null}playingId=null;loadingId=null;}
  function render(){
    if(!context)return;
    const voices=filterVoices(catalog?.voices||[],{type:context.type,language:language.value,gender:gender.value,search:search.value});
    document.querySelector('#voiceCount').textContent=`${voices.length} ${voices.length===1?"voice":"voices"}`;
    list.innerHTML=voices.map(voice=>{
      const compatible=!voice.languageCode||context.allowedLanguages.includes(voice.languageCode);
      const playing=voice.id===playingId;const loading=voice.id===loadingId;
      return `<li class="voice-row ${context.selectedId===voice.id?'selected':''}"><div class="voice-info"><strong>${escape(voice.name)}</strong><span>${escape(voice.languageCode?languageLabel(voice.languageCode):voice.language)} · ${escape(voice.timbre)} · ${context.type==='pro'?'Pro':'Common'}</span><code title="${escape(voice.id)}">${escape(voice.id)}</code></div><div class="voice-actions"><button type="button" data-play-voice="${escape(voice.id)}" aria-label="${playing?'Pause':'Play'} ${escape(voice.name)} sample" ${!voice.previewUrl||loading?'disabled':''}>${!voice.previewUrl?'No preview':loading?'Loading…':playing?'Pause':'▶ Preview'}</button><button type="button" data-use-voice="${escape(voice.id)}" ${compatible?'':'disabled'} title="${compatible?'Use this voice':'This language is not shared by the selected models'}">${context.selectedId===voice.id?'Selected':'Use voice'}</button></div></li>`;
    }).join('')||'<li class="voice-empty">No matching voices. Try another language or search, or enter a Voice ID manually in Settings.</li>';
  }
  async function load(refresh=false){
    const button=document.querySelector('#refreshVoices');button.disabled=true;
    status.textContent=refresh?'Refreshing the provider directory…':'Loading voices…';
    try{
      catalog=await api(`/api/voices${refresh?'?refresh=1':''}`);
      onData(catalog.voices);
      const codes=[...new Set(catalog.voices.filter(voice=>voice.type===context.type).map(voice=>voice.languageCode).filter(Boolean))];
      const previous=language.value||context.language;
      language.innerHTML='<option value="all">All languages</option>'+codes.map(code=>`<option value="${escape(code)}">${escape(languageLabel(code))}</option>`).join('');
      language.value=codes.includes(previous)?previous:'all';
      status.textContent=`${catalog.source==='live'?'Provider directory':'Saved provider directory'} · Updated ${new Date(catalog.updatedAt).toLocaleDateString('en-US')}${catalog.warning?' · Refresh unavailable; saved voices remain available.':''}`;
      render();
    }catch(error){status.textContent=error.message;render();}finally{button.disabled=false;}
  }
  async function preview(voice){
    if(voice.id===playingId){stop();render();return}
    stop();const player=new Audio(voice.previewUrl);audio=player;loadingId=voice.id;render();
    player.onended=()=>{if(audio===player){stop();render()}};
    player.onerror=()=>{if(audio===player){stop();render();toast('This sample is unavailable. You can still use the Voice ID.')}};
    try{await player.play();if(audio===player){playingId=voice.id;loadingId=null;render()}}catch{if(audio===player){stop();render();toast('Preview could not play. Please try another voice.')}}
  }
  list.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button||button.disabled)return;
    const id=button.dataset.playVoice||button.dataset.useVoice;
    const voice=catalog?.voices.find(item=>item.id===id&&item.type===context.type);if(!voice)return;
    if(button.dataset.playVoice)preview(voice);
    else{onSelect(voice,context);stop();dialog.close();}
  });
  search.addEventListener('input',()=>{stop();render()});language.addEventListener('change',()=>{stop();render()});gender.addEventListener('change',()=>{stop();render()});
  document.querySelector('#closeVoices').addEventListener('click',()=>dialog.close());
  document.querySelector('#refreshVoices').addEventListener('click',()=>load(true));
  dialog.addEventListener('close',stop);
  return {open(options){stop();context=options;search.value='';gender.value='all';language.value=options.language;document.querySelector('#voiceTypeLabel').textContent=options.type==='pro'?'Pro voices':'Common voices';dialog.showModal();load();},stop};
}
