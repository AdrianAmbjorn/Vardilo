process.env.TZ='Europe/Stockholm';
const {test}=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');const {stripTypeScriptTypes}=require('node:module');const source=stripTypeScriptTypes(readFileSync('lib/next-calendar-event.ts','utf8')).replaceAll('export ','');const nextCalendarEvent=new Function(`${source};return nextCalendarEvent`)();
const base={id:'training',starts_at:'2026-09-03T16:00:00Z',ends_at:'2026-09-03T17:30:00Z',all_day:false,recurrence_enabled:true,recurrence_days:[3],recurrence_end_date:'2026-12-31',target_member_id:'child'};
test('a weekly training with a past original date still appears as the next occurrence',()=>{
 const now=new Date('2026-11-05T12:00:00Z');const event=nextCalendarEvent([base],now);assert.equal(event.id,'training');assert.equal(event.starts_at,'2026-11-05T17:00:00.000Z');assert.equal(event.target_member_id,'child');
});
test('a visible activity assigned to another family member is not excluded',()=>{
 const event={...base,recurrence_enabled:false,starts_at:'2026-11-06T17:00:00Z',ends_at:null};assert.equal(nextCalendarEvent([event],new Date('2026-11-05T12:00:00Z')).id,'training');
});
test('ongoing events and all-day events today remain visible, finished events are skipped',()=>{
 const now=new Date('2026-11-05T12:00:00Z');const one={...base,recurrence_enabled:false,starts_at:'2026-11-05T11:00:00Z',ends_at:'2026-11-05T13:00:00Z'};assert.equal(nextCalendarEvent([one],now).id,'training');
 assert.equal(nextCalendarEvent([{...one,ends_at:'2026-11-05T11:30:00Z'}],now),null);
 assert.equal(nextCalendarEvent([{...one,all_day:true,starts_at:'2026-11-04T23:00:00Z',ends_at:null}],now).id,'training');
});
test('after training ends the next week is selected, and expired recurrence series are skipped',()=>{
 const next=nextCalendarEvent([base],new Date('2026-11-05T20:00:00Z'));assert.equal(next.starts_at,'2026-11-12T17:00:00.000Z');
 assert.equal(nextCalendarEvent([{...base,recurrence_end_date:'2026-10-31'}],new Date('2026-11-05T12:00:00Z')),null);
});
