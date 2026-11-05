const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const source=stripTypeScriptTypes(readFileSync('lib/countdown.ts','utf8')).replaceAll('export ','');
const { countdownRemaining,parseCountdownDate }=new Function(`${source};return {countdownRemaining,parseCountdownDate};`)();
const remaining=(kind,date,today)=>countdownRemaining({kind,target_date:date},today);
test('birthday counts today and then rolls to the next year',()=>{
 assert.equal(remaining('birthday','2000-11-05',new Date(2026,10,5,23,59)).days,0);
 assert.equal(remaining('birthday','2000-11-05',new Date(2026,10,6)).days,364);
});
test('Christmas automatically targets the next 24 December',()=>{
 assert.equal(remaining('christmas','2000-12-24',new Date(2026,11,23)).days,1);
 assert.equal(remaining('christmas','2000-12-24',new Date(2026,11,24)).days,0);
 assert.equal(remaining('christmas','2000-12-24',new Date(2026,11,25)).target.getFullYear(),2027);
});
test('leap birthdays use 28 February without a leap day and 29 February in leap years',()=>{
 assert.equal(remaining('birthday','2000-02-29',new Date(2027,1,27)).days,1);
 assert.equal(remaining('birthday','2000-02-29',new Date(2028,1,28)).days,1);
});
test('calendar-day counting is stable across daylight-saving changes',()=>{
 assert.equal(remaining('custom','2026-03-30',new Date(2026,2,28,23,50)).days,2);
 assert.equal(remaining('custom','2026-10-26',new Date(2026,9,24,23,50)).days,2);
});
test('past events are marked as past and never show negative days',()=>{
 const result=remaining('custom','2026-11-04',new Date(2026,10,5));
 assert.equal(result.past,true);assert.equal(result.days,0);
});
test('invalid dates cannot become a countdown',()=>{
 for(const date of ['2026-02-29','2000-04-31','2026-13-01','bad','0001-01-01'])assert.equal(parseCountdownDate(date),null);
 assert.equal(remaining('custom','bad',new Date()),null);
});
