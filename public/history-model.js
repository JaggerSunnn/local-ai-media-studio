export const sourceLabels={api_request:'API request',interface:'Interface'};
export function taskSource(task){
  const explicit=task.meta?.source||task.source;
  if(Object.hasOwn(sourceLabels,explicit))return explicit;
  return task.batch?.id||task.meta?.operation?'interface':'api_request';
}
export function retainedHistory(tasks,now=Date.now()){
  return tasks.filter(task=>taskSource(task)==='interface'||new Date(task.createdAt).getTime()>=now-24*60*60*1000);
}
export function relativeTime(value,now=Date.now()){
  const date=new Date(value).getTime();if(!Number.isFinite(date))return 'Time unavailable';
  const seconds=Math.max(0,Math.floor((now-date)/1000));
  if(seconds<60)return 'Just now';
  const minutes=Math.floor(seconds/60);if(minutes<60)return `${minutes}m ago`;
  const hours=Math.floor(minutes/60);if(hours<24)return `${hours}h ago`;
  return `${Math.floor(hours/24)}d ago`;
}
export function historyEntries(tasks){
  return [...tasks].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).flatMap(task=>{
    const outputs=task.outputs?.length?task.outputs:[null];
    return outputs.map((output,index)=>({task,output,index,source:taskSource(task),prompt:task.meta?.prompt||task.batch?.prompt||'',time:task.completedAt||task.createdAt}));
  });
}
export function filterHistory(entries,{sources=['api_request','interface'],status='all',query=''}={}){
  const text=query.toLowerCase().trim();
  return entries.filter(entry=>sources.includes(entry.source)&&(status==='all'||(status==='generating'?!['succeeded','failed'].includes(entry.task.status):entry.task.status===status))&&(!text||`${entry.prompt} ${entry.task.modelId} ${entry.modelLabel||''}`.toLowerCase().includes(text)));
}
export function mediaUrl(output){
  const value=output?.localUrl||output?.url||'';
  return /^\/local\//.test(value)||/^https?:\/\//i.test(value)?value:'';
}
