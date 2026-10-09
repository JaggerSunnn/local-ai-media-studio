import {ttsLanguages, languageLabel} from './languages.js';
// First-release menu and task-specific contracts shared by browser and local server.
const operation = (id, label, models, defaultModel) => ({id, label, models, defaultModel});
const videoModels = ['dreamvideo-3-text','wan-text-video','seedance-2-5','seedance-2','seedance-2-mini'];
export const capabilities = {
  video: {label:'Video', operations:[
    operation('text-to-video','Text to Video',videoModels,'dreamvideo-3-text'),
    operation('image-to-video','Image to Video',['dreamvideo-3-image','wan-image-video',...videoModels.slice(2)],'dreamvideo-3-image'),
    operation('first-last-frame','First / Last Frame (FLF)',['wan-head-tail','dreamvideo-3-image',...videoModels.slice(2)],'dreamvideo-3-image'),
    operation('reference-to-video','Reference to Video',[...videoModels.slice(2)],'seedance-2-5')
  ]},
  image: {label:'Image', operations:[
    operation('text-to-image','Text to Image',['flux-text-image','seedream','nano-banana-2','nano-banana-pro','gpt-image-2','gpt-image-2-5-flare-text','gpt-image-2-5-sunburst-text'],'gpt-image-2'),
    operation('image-to-image','Image to Image',['flux-image-image','dreamimage-2','seedream','nano-banana-2','nano-banana-pro','gpt-image-2','gpt-image-2-5-flare-edit','gpt-image-2-5-sunburst-edit'],'gpt-image-2'),
    operation('image-editing','Image Editing',['image-enhance','image-colorize','image-outpainting','image-swap-face','image-remove-bg'],'image-enhance')
  ]},
  audio: {label:'Audio', operations:[
    operation('text-to-speech','Text to Speech',['tts-common','tts-pro','tts-clone'],'tts-common'),
    operation('voice-clone','Voice Clone',['voice-clone'],'voice-clone')
  ]},
  avatar: {label:'Avatar', operations:[
    operation('talking-avatar','Talking Avatar',['dreamavatar-3-fast'],'dreamavatar-3-fast'),
    operation('lip-sync','Lip Sync',['lipsync-2','lipsync-v1'],'lipsync-2'),
    operation('motion-transfer','Motion Transfer',['dreamact-2-1'],'dreamact-2-1')
  ]}
};
const labels = {
  'dreamvideo-3-text':'DreamVideo 3.0','dreamvideo-3-image':'DreamVideo 3.0',
  'wan-text-video':'DreamVideo 1.5','wan-image-video':'DreamVideo 1.5','wan-head-tail':'DreamVideo 1.5',
  'flux-text-image':'Flux','flux-image-image':'Flux',
  'gpt-image-2-5-flare-text':'GPT Image 2.5 Flare','gpt-image-2-5-flare-edit':'GPT Image 2.5 Flare',
  'gpt-image-2-5-sunburst-text':'GPT Image 2.5 Sunburst','gpt-image-2-5-sunburst-edit':'GPT Image 2.5 Sunburst',
  'image-enhance':'Enhance','image-colorize':'Colorize','image-outpainting':'Outpainting',
  'image-swap-face':'Swapface','image-remove-bg':'Remove Background',
  'tts-common':'Do TTS Common','tts-pro':'Do TTS Pro','tts-clone':'Do TTS Clone',
  'voice-clone':'Voice Clone','dreamact-2-1':'DreamAct'
};
const imageField = (id,label,api=id,extra={}) => ({id,label,api,type:'image',required:true,...extra});
export function resolveLaunchModel(base, operationId) {
  if (!base || base.status !== 'active') return base;
  const model = {...base,label:labels[base.id]||base.label,inputs:base.inputs.map(field=>({...field})),options:base.options.map(option=>({...option}))};
  const setDefault = (id,value) => {const option=model.options.find(item=>item.id===id);if(option)option.value=value;};
  if(base.id.startsWith('wan-'))model.settingsNote='Duration and aspect ratio use the model defaults; this endpoint does not expose these controls.';
  if (operationId==='text-to-video') model.inputs=model.inputs.filter(field=>field.type==='textarea');
  if (operationId==='image-to-video') {
    const prompt=model.inputs.find(field=>field.type==='textarea');
    const image=base.id==='dreamvideo-3-image'?imageField('first','First frame image','images',{apiArray:true}):base.id==='wan-image-video'?imageField('image','First frame image'):imageField('imageUrl','First frame or reference image','imageUrl');
    model.inputs=[image,...(prompt?[prompt]:[])];
  }
  if (operationId==='first-last-frame') {
    const prompt=model.inputs.find(field=>field.type==='textarea');
    model.inputs=base.id==='dreamvideo-3-image'
      ?[imageField('first','First frame image','images',{apiArray:true}),imageField('last','Last frame image','images',{apiArray:true})]
      :base.id==='wan-head-tail'?[imageField('first','First frame image','firstImage'),imageField('last','Last frame image','lastImage')]:[imageField('imageUrl','First frame image'),imageField('endImageUrl','Last frame image')];
    if(prompt)model.inputs.push({...prompt,label:'Transition prompt'});
  }
  if (operationId==='reference-to-video') {
    model.inputs=model.inputs.filter(field=>!['imageUrl','endImageUrl'].includes(field.id));
    model.referenceRequired=true;
    model.settingsNote='Upload at least one reference image, video, or audio file. Limits depend on the selected model.';
  }
  if(operationId==='text-to-image')model.inputs=model.inputs.filter(field=>field.type!=='image');
  if(operationId==='image-to-image') {
    model.inputs=model.inputs.map(field=>field.type==='image'?{...field,required:true,label:'Reference image'}:field);
  }
  if(['text-to-image','image-to-image'].includes(operationId)) {
    // 848×480 respects the documented multiple-of-16 constraint; exact 16:9 at
    // height 480 would be non-integral. Other models retain their supported minimum.
    const gpt25=base.id.startsWith('gpt-image-2-5');
    setDefault('width',gpt25?1280:848);setDefault('height',gpt25?720:480);setDefault('aspectRatio','16:9');
    setDefault('imageSize',base.id==='nano-banana-pro'?'1K':'512');setDefault('size','1K');
    model.settingsNote=base.id==='seedream'?'This model uses a minimum of 1K. Describe the aspect ratio in your prompt.'
      :base.id==='nano-banana-pro'?'Minimum supported size: 1K. Default aspect ratio: 16:9.'
      :base.id==='nano-banana-2'?'Minimum supported size: 512. Default aspect ratio: 16:9.'
      :gpt25?'Default 1280×720 · 16:9 · 1 image (valid landscape preset).':model.options.some(option=>option.id==='width')?'Default 848×480 (near 16:9, aligned to 16 pixels), 1 image per run.'
      :'Use the source image dimensions, 1 image per run.';
  }
  if(operationId==='image-editing'&&base.id==='image-outpainting')setDefault('left',128);
  if(['text-to-image','image-to-image'].includes(operationId)){model.options=model.options.map(option=>['width','height'].includes(option.id)?{...option,min:16,max:base.id.startsWith('flux-')?1600:3840,step:16}:option);}
  if(operationId==='lip-sync')setDefault('enhance',base.id==='lipsync-2'?'0':false);
  if(operationId==='text-to-speech') {
    const languages=ttsLanguages[base.id]||['en'];
    model.options=model.options.map(option=>option.id==='language'?{...option,type:'select',values:languages,valueLabels:Object.fromEntries(languages.map(code=>[code,languageLabel(code)])),value:'en',label:'Language'}:option);
    // Published API examples identify these voices; cloned IDs must come from the user.
    const audio=model.inputs.find(field=>field.id==='audioId');
    if(audio)audio.value=base.id==='tts-common'?'41995cfdb1a84924a21aa31492573fc1':'b90847cb8cfe4446881c6a3e15118084';
    model.settingsNote=base.id==='tts-clone'?'Enter an existing cloneId. 1 audio clip per run.':'Choose or enter a Voice ID matching your language. 1 audio clip per run.';
  }
  if(operationId==='voice-clone')model.settingsNote='Upload 1 voice sample at its original specification. The result is a cloneId for Text to Speech.';
  return model;
}
