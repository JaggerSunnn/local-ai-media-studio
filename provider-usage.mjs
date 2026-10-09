export function reportedCredits(data){
  const candidates=[['task.creditsConsumed',data?.task?.creditsConsumed],['creditsConsumed',data?.creditsConsumed]];
  for(const [field,value] of candidates){
    if(typeof value!=='number'&&typeof value!=='string')continue;
    if(typeof value==='string'&&!/^\d+(?:\.\d+)?$/.test(value.trim()))continue;
    const credits=Number(value);
    if(Number.isFinite(credits)&&credits>=0)return {credits,field};
  }
  return {credits:null,field:null};
}
