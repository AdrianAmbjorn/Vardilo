const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const source = stripTypeScriptTypes(readFileSync('lib/daily-tasks.ts','utf8')).replace(/export /g,'');
const { stockholmDate, taskIsCurrent, canCompleteDailyTask } = new Function(`${source};return {stockholmDate,taskIsCurrent,canCompleteDailyTask}`)();
const task={scheduled_date:'2026-11-06',completed_at:null,assigned_member_id:'child'};
test('daily completion is limited to the assigned child and the current Stockholm day',()=>{
 assert.equal(canCompleteDailyTask(task,{id:'child',role:'barn'},'2026-11-06'),true);
 for(const member of [{id:'parent',role:'admin'},{id:'parent',role:'förälder'},{id:'other',role:'barn'},null]) assert.equal(canCompleteDailyTask(task,member,'2026-11-06'),false);
 for(const day of ['2026-11-05','2026-11-07']) assert.equal(canCompleteDailyTask(task,{id:'child',role:'barn'},day),false);
 assert.equal(canCompleteDailyTask({...task,completed_at:'done'},{id:'child',role:'barn'},'2026-11-06'),false);
});
test('daily date rolls over at Swedish midnight including summer time',()=>{
 assert.equal(stockholmDate(new Date('2026-11-05T23:00:00Z')),'2026-11-06');
 assert.equal(stockholmDate(new Date('2026-07-05T22:00:00Z')),'2026-07-06');
 assert.equal(taskIsCurrent(task,'2026-11-06'),true);
 assert.equal(taskIsCurrent(task,'2026-11-07'),false);
 assert.equal(taskIsCurrent({scheduled_date:null},'2026-11-07'),true);
});

const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const babel=require('next/dist/compiled/babel/core');
function component(path,overrides){
 const code=babel.transformSync(readFileSync(path,'utf8'),{filename:path,presets:[[require('next/babel'),{'preset-env':{targets:{node:'current'}},'preset-react':{runtime:'automatic'},'transform-runtime':{helpers:false,regenerator:false}}]],envName:'test',babelrc:false,configFile:false}).code;
 const exports={};require('node:vm').runInNewContext(code,{exports,require:name=>overrides[name]??(name.endsWith('.css')?{}:require(name))});return exports.default;
}
function renderTasks(role,done=false){
 const member={id:role==='barn'?'child':'parent',role,family_id:'family'};
 const states=[member,[{...member,display_name:'Test',xp_goal:500}],false,null,'500','',false,[{...task,id:'daily',title:'Bädda sängen',xp:20,due_at:'2026-11-06T12:00:00Z',daily_series_id:'series',series_start:'2026-11-06',series_end:'2026-11-08',completed_at:done?'2026-11-06T09:00:00Z':null}]];states[27]=false;
 let cursor=0;
 const hooks={...React,useMemo:fn=>fn(),useEffect:()=>{},useRef:value=>({current:value}),useState:initial=>[cursor in states?states[cursor++]: (cursor++,initial),()=>{}]};
 const Page=component('app/uppgifter/page.tsx',{react:hooks,'@/lib/supabase/client':{createClient:()=>({})},'@/lib/daily-tasks':{taskIsCurrent,canCompleteDailyTask},'@/lib/use-stockholm-date':{useStockholmDate:()=> '2026-11-06'}});
 return renderToStaticMarkup(React.createElement(Page));
}
test('daily task UI gives parents status only and shows a green check for a completed day',()=>{
 const parent=renderTasks('admin');assert.doesNotMatch(parent,/Markera klar idag/);assert.match(parent,/Väntar på barnet/);
 const child=renderTasks('barn');assert.match(child,/Markera klar idag/);
 const done=renderTasks('admin',true);assert.match(done,/class="daily-done" role="img" aria-label="Klar">✓/);assert.doesNotMatch(done,/>Ångra</);
});
test('global banner displays all notifications while the chat badge remains chat-specific',()=>{
 let cursor=0;const hooks={...React,useMemo:fn=>fn(),useEffect:()=>{},useState:()=>[[2,'child'][cursor++],()=>{}]};
 const Banner=component('app/components/chat-notification-banner.tsx',{react:hooks,'./language-provider':{useLanguage:()=>({language:'sv',locale:'sv-SE',t:text=>text})},'next/navigation':{usePathname:()=>'/uppgifter'},'@/lib/supabase/client':{createClient:()=>({})}});
 const html=renderToStaticMarkup(React.createElement(Banner));assert.match(html,/2 olästa notiser/);assert.match(html,/href="\/notiser"/);cursor=0;const badge=renderToStaticMarkup(React.createElement(Banner,{variant:"badge"}));assert.match(badge,/2 olästa meddelanden/);assert.doesNotMatch(badge,/href=/);
});
