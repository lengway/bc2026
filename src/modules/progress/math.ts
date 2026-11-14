const initialThresholds=[100,250,500,900,1400];
export function levelForXp(xp:number):{level:number;nextLevelXp:number} {
  if(!Number.isSafeInteger(xp)||xp<0) throw new Error('XP must be a non-negative integer');
  for(const [index,threshold] of initialThresholds.entries()) if(xp<threshold) return {level:index+1,nextLevelXp:threshold};
  let level=6,next=2000,increment=700;
  while(xp>=next) {level++;next+=increment;increment+=100;}
  return {level,nextLevelXp:next};
}
export function localDate(instant:Date,timezone:string):string {
  let formatter:Intl.DateTimeFormat;
  try {formatter=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'});}
  catch {formatter=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'});}
  const parts=formatter.formatToParts(instant);
  const value=(type:string)=>parts.find(part=>part.type===type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export const dayNumber=(day:string)=>Math.floor(Date.parse(`${day}T00:00:00Z`)/86_400_000);
export function streakFromDays(days:readonly string[]) {
  let current=0,best=0,previous:number|undefined;
  for(const day of [...new Set(days)].sort()) {
    const ordinal=dayNumber(day);
    current=previous!==undefined&&ordinal===previous+1?current+1:1;
    best=Math.max(best,current);previous=ordinal;
  }
  return {current,best,lastPracticeDate:[...new Set(days)].sort().at(-1)??null};
}
