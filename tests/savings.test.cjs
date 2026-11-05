const {test}=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');const {stripTypeScriptTypes}=require('node:module');const source=stripTypeScriptTypes(readFileSync('lib/savings.ts','utf8')).replaceAll('export ','');const {savingsAmount,savingsProjection}=new Function(`${source};return {savingsAmount,savingsProjection}`)();
test('saving 20 or 100 kronor gives clear weekly and monthly yearly examples',()=>{
 assert.equal(savingsProjection(10000,2000,'week').year,104000);assert.equal(savingsProjection(10000,2000,'month').year,24000);
 assert.equal(savingsProjection(10000,10000,'week').year,520000);assert.equal(savingsProjection(10000,10000,'month').year,120000);
 const plan=savingsProjection(10000,2000,'week');assert.equal(plan.keep,8000);assert.equal(plan.periods,52);assert.equal(plan.example20,104000);assert.equal(plan.example100,520000);
});
test('saving inputs preserve cents and allow zero, but reject negative or malformed amounts',()=>{
 assert.equal(savingsAmount('20,50'),2050);assert.equal(savingsAmount('0'),0);assert.equal(savingsAmount('100'),10000);
 for(const value of ['','-20','100,123','1e3','1000001'])assert.equal(savingsAmount(value),null);
});
