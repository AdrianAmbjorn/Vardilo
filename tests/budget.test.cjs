const {test}=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(readFileSync('lib/budget.ts','utf8')).replaceAll('export ','');const {budgetAmount,budgetSummary}=new Function(`${source};return {budgetAmount,budgetSummary}`)();
test('budget inputs store exact cents and reject negative or invalid amounts',()=>{
 assert.equal(budgetAmount('1 299,50'),129950);assert.equal(budgetAmount('0,01'),1);assert.equal(budgetAmount('199.5'),19950);
 for(const value of ['0','-1','1,234','1e6','','1000000001'])assert.throws(()=>budgetAmount(value));
});
test('only shared entries enter the monthly division and private entries stay in overall totals',()=>{
 const rows=[{kind:'expense',amount_cents:100000,member_id:'a',shared:true},{kind:'expense',amount_cents:30000,member_id:'b',shared:false},{kind:'income',amount_cents:20000,member_id:'a',shared:true},{kind:'income',amount_cents:300000,member_id:'b',shared:false}];
 const result=budgetSummary(rows,['a','b']);assert.equal(result.income,320000);assert.equal(result.expense,130000);assert.equal(result.balance,190000);assert.equal(result.net,80000);
 assert.deepEqual(result.people.map(p=>p.share),[40000,40000]);assert.deepEqual(result.people.map(p=>p.settlement),[40000,-40000]);
});
test('division preserves every cent for odd totals, shared surplus and zero participants',()=>{
 for(const kind of ['income','expense'])for(const amount of [1,2,101,99999]){
  const result=budgetSummary([{kind,amount_cents:amount,member_id:'a',shared:true}],['b','a','c']);
  assert.equal(result.people.reduce((sum,p)=>sum+p.share,0),result.net);
  assert.equal(result.people.reduce((sum,p)=>sum+p.settlement,0),0);
 }
 assert.equal(budgetSummary([],[]).people.length,0);
});
function handler(name,end,env){const s=readFileSync('app/budget/page.tsx','utf8');const start=s.indexOf(` async function ${name}(`);const code=stripTypeScriptTypes(s.slice(start,s.indexOf(end,start)));return new Function(...Object.keys(env),`${code};return ${name}`)(...Object.values(env))}
test('editing a budget row is scoped to its family and month and keeps cents exact',async()=>{
 let payload,filters={},rows;const q={update(value){payload=value;return q},eq(key,value){filters[key]=value;return q},select(){return q},single:async()=>({data:{id:'row'},error:null})};
 const env={member:{id:'parent',family_id:'family'},busy:false,lock:{current:false},authEpoch:{current:0},failed:false,savedAt:null,draft:{title:' Rent ',amount:'9 999,99',kind:'expense',member_id:'parent',shared:true},parents:[{id:'parent'}],budgetAmount,editing:'row',month:'2026-11',draftId:{current:'request'},setError(){},setBusy(){},supabase:{from:()=>q},setRows:update=>rows=update([{id:'row',amount_cents:100}]),setDraft(){},setEditing(){},empty:{}};
 await handler('save',' async function share',env)({preventDefault(){}});assert.deepEqual(filters,{id:'row',family_id:'family',month:'2026-11-01'});assert.equal(payload.amount_cents,999999);assert.equal(payload.title,'Rent');assert.equal(rows[0].amount_cents,999999);assert.equal(env.lock.current,false);
});
test('a failed share update leaves the displayed shared total unchanged',async()=>{
 let changed=false,error;const q={update:()=>q,eq:()=>q,select:()=>q,single:async()=>({error:Error('offline')})};const env={member:{id:'parent',family_id:'family'},lock:{current:false},authEpoch:{current:0},failed:false,savedAt:null,setBusy(){},setError:value=>error=value,supabase:{from:()=>q},setRows:()=>changed=true};
 await handler('share',' async function remove',env)({id:'row',shared:false});assert.equal(changed,false);assert.match(error,/kunde inte sparas/);assert.equal(env.lock.current,false);
});
test('saving a month requests an archive snapshot for the selected month',async()=>{
 let args,reloaded=false;const env={member:{id:'parent'},lock:{current:false},authEpoch:{current:0},failed:false,loading:false,editing:null,draft:{title:'',amount:''},savedAt:null,month:'2026-09',setBusy(){},setError(){},supabase:{rpc:async(name,value)=>{assert.equal(name,'save_budget_month');args=value;return {error:null}}},setRetry:()=>reloaded=true};
 await handler('saveMonth',' return <main',env)();assert.deepEqual(args,{p_month:'2026-09-01',p_action:'save'});assert.equal(reloaded,true);assert.equal(env.lock.current,false);
});
test('unsaved draft prevents archiving and losing entered text',async()=>{
 let called=false;const env={member:{id:'parent'},lock:{current:false},authEpoch:{current:0},failed:false,loading:false,editing:null,draft:{title:'New rent',amount:'300'},supabase:{rpc:()=>called=true}};
 await handler('saveMonth',' return <main',env)();assert.equal(called,false);
});
