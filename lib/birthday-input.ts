export function birthdayParts(month: string, day: string): { birthday_month: number; birthday_day: number } | null {
 if (!month && !day) return null;
 if (!/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) throw new Error("Välj en giltig dag och månad, eller lämna båda tomma.");
 const m=Number(month),d=Number(day),date=new Date(Date.UTC(2000,m-1,d));
 if(m<1||m>12||d<1||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)throw new Error("Välj en giltig dag och månad, eller lämna båda tomma.");
 return {birthday_month:m,birthday_day:d};
}
