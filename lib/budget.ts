export type BudgetEntry = { id:string; title:string; kind:"income"|"expense"; amount_cents:number; member_id:string; shared:boolean };
export function budgetAmount(value:string):number {
 const raw=value.trim().replace(/[\s\u00a0]/g,"").replace(",", ".");
 if(!/^\d+(\.\d{1,2})?$/.test(raw))throw new Error("Ange ett belopp i kronor med högst två decimaler.");
 const [whole,part=""]=raw.split(".");const cents=Number(whole)*100+Number(part.padEnd(2,"0"));
 if(!Number.isSafeInteger(cents)||cents<=0||cents>100_000_000_000)throw new Error("Ange ett belopp större än noll, högst en miljard kronor.");
 return cents;
}
export function kronor(cents:number):string{return new Intl.NumberFormat("sv-SE",{style:"currency",currency:"SEK",maximumFractionDigits:2}).format(cents/100)}
export function budgetSummary(entries:BudgetEntry[],parents:string[]){
 let income=0,expense=0,sharedIncome=0,sharedExpense=0;const paid:Record<string,number>={};
 for(const row of entries){if(row.kind==="income")income+=row.amount_cents;else expense+=row.amount_cents;if(row.shared){if(row.kind==="income")sharedIncome+=row.amount_cents;else sharedExpense+=row.amount_cents;paid[row.member_id]=(paid[row.member_id]??0)+(row.kind==="expense"?row.amount_cents:-row.amount_cents)}}
 const net=sharedExpense-sharedIncome;const ids=[...new Set(parents)].sort();const base=ids.length?Math.floor(net/ids.length):0;const remainder=ids.length?net-base*ids.length:0;
 return {income,expense,balance:income-expense,sharedIncome,sharedExpense,net,people:ids.map((id,i)=>({id,share:base+(i<remainder?1:0),paid:paid[id]??0,settlement:(paid[id]??0)-base-(i<remainder?1:0)}))};
}
