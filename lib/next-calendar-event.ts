export type UpcomingEvent={id:string;starts_at:string;ends_at:string|null;all_day:boolean;recurrence_enabled:boolean;recurrence_days:number[];recurrence_end_date:string|null};
function dayKey(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function isCurrentOrFuture(event:UpcomingEvent,now:Date){
 const start=new Date(event.starts_at);const end=event.ends_at?new Date(event.ends_at):null;
 return start>=now||(end!==null&&end>now)||(event.all_day&&!end&&dayKey(start)===dayKey(now));
}
export function nextCalendarEvent<T extends UpcomingEvent>(events:T[],now=new Date()):T|null{
 const candidates:T[]=[];
 for(const event of events){
  const start=new Date(event.starts_at);if(!Number.isFinite(start.getTime()))continue;
  if(!event.recurrence_enabled||!event.recurrence_end_date||!(event.recurrence_days??[]).length){if(isCurrentOrFuture(event,now))candidates.push(event);continue}
  const endLimit=new Date(`${event.recurrence_end_date}T23:59:59`);
  const duration=event.ends_at?Math.max(0,Date.parse(event.ends_at)-start.getTime()):0;
  if(endLimit.getTime()+duration<now.getTime())continue;
  const lookback=Math.min(366,Math.ceil(duration/86400000));
  const cursor=new Date(now);cursor.setDate(cursor.getDate()-lookback);cursor.setHours(start.getHours(),start.getMinutes(),start.getSeconds(),start.getMilliseconds());
  if(cursor<start)cursor.setTime(start.getTime());
  for(let count=0;cursor<=endLimit&&count<lookback+9;count++,cursor.setDate(cursor.getDate()+1)){
   if(!event.recurrence_days.includes((cursor.getDay()+6)%7))continue;
   const occurrence={...event,starts_at:cursor.toISOString(),ends_at:duration>0?new Date(cursor.getTime()+duration).toISOString():null};
   if(event.all_day&&event.ends_at){const end=new Date(cursor);end.setDate(end.getDate()+Math.round((Date.parse(dayKey(new Date(event.ends_at)))-Date.parse(dayKey(start)))/86400000));occurrence.ends_at=end.toISOString()}
   if(isCurrentOrFuture(occurrence,now)){candidates.push(occurrence);break}
  }
 }
 return candidates.sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at))[0]??null;
}
