export const terminal=task=>['succeeded','failed'].includes(task.status);
const numeric=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
export function taskTiming(task){
  if(!terminal(task))return null;
  if(numeric(task.executionTimeMs))return {ms:task.executionTimeMs,basis:'inference',label:'Generation'};
  const elapsed=new Date(task.completedAt).getTime()-new Date(task.createdAt).getTime();
  return Number.isFinite(elapsed)&&elapsed>=0?{ms:elapsed,basis:'elapsed',label:'Elapsed'}:null;
}
export function taskCredits(task){return task.mode!=='mock'&&terminal(task)&&numeric(task.consumedCredits)?task.consumedCredits:null;}
export function outputCredits(task){const credits=taskCredits(task);const count=(task.outputs||[]).filter(output=>['image','video','audio'].includes(output.kind)).length;return credits===null?null:credits/Math.max(1,count);}
export function formatCost(credits,billing={}){
  if(!numeric(credits))return 'Not reported';
  if(billing.unit==='usd'&&numeric(billing.usdPerCredit)){
    const amount=credits*billing.usdPerCredit;
    return amount>0&&amount<.0001?'<$0.0001':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:4,maximumFractionDigits:4}).format(amount);
  }
  return `${new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(credits)} credits`;
}
export function groupTasks(tasks){
  const groups=[];const explicit=new Map();
  for(const task of [...tasks].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt))){
    if(task.batch?.id){
      let group=explicit.get(task.batch.id);
      if(!group){group={...task.batch,tasks:[],recovered:false};explicit.set(group.id,group);groups.push(group)}
      group.tasks.push(task);continue;
    }
    // Only recover legacy submissions with identical input fingerprints and prompt,
    // created close together. They remain visibly identified as recovered groups.
    const previous=groups.at(-1);
    const same=previous?.recovered&&task.inputFingerprint&&previous.fingerprint===task.inputFingerprint&&previous.prompt===(task.meta?.prompt||'')&&previous.operation===(task.meta?.operation||'')&&Math.abs(new Date(task.createdAt)-new Date(previous.createdAt))<=2000;
    if(same){previous.tasks.push(task);previous.modelIds=[...new Set([...previous.modelIds,task.modelId])];previous.expectedTasks=previous.tasks.length;continue}
    groups.push({id:`recovered-${task.id}`,createdAt:task.createdAt,category:task.meta?.category||'',operation:task.meta?.operation||'',prompt:task.meta?.prompt||'',options:task.options||{},modelIds:[task.modelId],assets:[],expectedTasks:1,recovered:true,fingerprint:task.inputFingerprint,tasks:[task]});
  }
  return groups.reverse();
}
export function comparisonBadges(group){
  const result=new Map();
  if(group.tasks.length<group.expectedTasks||!group.tasks.every(terminal))return result;
  const buckets=new Map();
  for(const task of group.tasks){const key=task.meta?.comparisonKey||'default';if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(task);}
  for(const bucket of buckets.values()){
    const candidates=bucket.filter(task=>task.status==='succeeded'&&task.mode!=='mock');
    if(new Set(candidates.map(task=>task.modelId)).size<2)continue;
    const timing=candidates.map(taskTiming);
    const basis=timing.every(item=>item?.basis==='inference')?'inference':'elapsed';
    const times=candidates.map(task=>basis==='inference'?taskTiming(task)?.ms:new Date(task.completedAt)-new Date(task.createdAt));
    const costs=candidates.map(outputCredits);
    const knownTimes=times.every(numeric);const knownCosts=costs.every(numeric);
    const minTime=Math.min(...times);const minCost=Math.min(...costs);
    candidates.forEach((task,index)=>{
      const labels=[];
      if(knownTimes&&times[index]===minTime)labels.push({label:'Fastest',kind:'fast',title:basis==='inference'?'Lowest reported inference time in this comparison':'Shortest elapsed time to result; includes queue and polling'});
      if(knownCosts&&costs[index]===minCost)labels.push({label:'Cheapest',kind:'cheap',title:'Lowest reported credits per output in this comparison; task totals are split evenly across outputs'});
      if(labels.length)result.set(task.id,labels);
    });
  }
  return result;
}
export function groupCost(group){
  const reported=group.tasks.map(taskCredits).filter(value=>value!==null);
  return {credits:reported.length?reported.reduce((sum,value)=>sum+value,0):null,complete:reported.length===group.expectedTasks&&group.tasks.every(terminal),reported:reported.length,expected:group.expectedTasks};
}
