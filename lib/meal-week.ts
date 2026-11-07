export function mealWeek(date: Date, offset = 0) {
 const monday=new Date(date.getFullYear(),date.getMonth(),date.getDate());monday.setDate(monday.getDate()-(monday.getDay()+6)%7+offset*7);
 return Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(d.getDate()+i);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`});
}
export function mealWeekNumber(monday: string) {const date=new Date(`${monday}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+3);const start=Date.UTC(date.getUTCFullYear(),0,1);return Math.ceil(((date.getTime()-start)/86400000+1)/7);}
