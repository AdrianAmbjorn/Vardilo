export type AllowancePeriod="week"|"month";
export function savingsAmount(value:string):number|null{
 const raw=value.trim().replace(/[\s\u00a0]/g,"").replace(",",".");if(!/^\d+(\.\d{1,2})?$/.test(raw))return null;
 const [whole,part=""]=raw.split('.');const cents=Number(whole)*100+Number(part.padEnd(2,'0'));return Number.isSafeInteger(cents)&&cents<=100000000?cents:null;
}
export function savingsProjection(allowance:number,saving:number,period:AllowancePeriod){
 const periods=period==="week"?52:12;
 return {periods,year:saving*periods,keep:allowance-saving,example20:2000*periods,example100:10000*periods};
}
