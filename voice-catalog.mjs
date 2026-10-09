export const VOICE_SOURCE='https://aldfai-api.newportai.com/s/api-playground/dream_api/v1/list_audio';
const languageCodes={English:'en',Chinese:'zh-CN',Spanish:'es',Portuguese:'pt',Arabic:'ar',Arbic:'ar',Hindi:'hi',Indonesian:'id',Thai:'th'};
export function normalizeVoices(payload){
  const rows=payload?.data?.audioList||payload?.audioList;
  if(!Array.isArray(rows)||!rows.length)throw new Error('The provider returned an empty voice directory');
  const voices=[];const seen=new Set();
  for(const row of rows){
    const type=String(row.vision||'').toLowerCase();const id=String(row.audioId||'').trim();
    if(!['common','pro'].includes(type)||!id||seen.has(`${type}:${id}`))continue;
    seen.add(`${type}:${id}`);
    const language=row.lan==='Arbic'?'Arabic':String(row.lan||'Unknown');
    let previewUrl=null;try{const url=new URL(row.audioUrl);if(url.protocol==='https:')previewUrl=url.href}catch{}
    const timbres=(row.timbreList||[]).map(value=>String(value).toLowerCase());
    voices.push({id,name:String(row.audioName||id),type,language,languageCode:languageCodes[row.lan]||null,timbre:timbres.find(value=>['male','female'].includes(value))||'unknown',tags:timbres,previewUrl});
  }
  if(!voices.length)throw new Error('No supported Common or Pro voices were found');
  return voices;
}
