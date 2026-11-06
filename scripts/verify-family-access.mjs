// Read-only regression against the existing synthetic audit family. Never uses real families.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
const f=JSON.parse(fs.readFileSync('.audit/fixture-secrets.json'));
assert.match(f.run,/^audit-[a-f0-9]+$/);
const key=fs.readFileSync('.audit/public-key.txt','utf8').trim();
const clients=Array.from({length:3},()=>createClient('https://jnthaerbttgxnphkolvj.supabase.co',key,{auth:{persistSession:false,autoRefreshToken:false}}));
const [parent,second,child]=clients;
function ok(result){assert(!result.error,'API request must succeed');return result.data;}
try {
 for(const [client,email] of [[parent,f.users[0].email],[second,f.users[1].email],[child,f.childEmail]]) {
  ok(await client.auth.signInWithPassword({email,password:f.password}));
  assert.equal(ok(await client.from('families').select('name').eq('id',f.family).single()).name,f.run);
 }
 const hidden=ok(await parent.from('calendar_events').select('id').eq('family_id',f.family).eq('visible_to_children',false));
 assert(hidden.length>0,'fixture must contain hidden events');
 assert.equal(ok(await child.from('calendar_events').select('id').in('id',hidden.map(r=>r.id))).length,0);
 console.log('PASS child cannot read adult-only calendar entries');
 assert.equal(ok(await child.from('family_wishlist_reservations').select('item_id')).length,0);
 const protectedColumn=await child.from('family_wishlist_items').select('purchased');
 assert(protectedColumn.error);
 const wishes=ok(await child.rpc('get_wishlist_items',{p_wishlist_id:f.wishlist}));
 assert(wishes.length>0,'fixture must contain wishes');
 assert(wishes.every(w=>w.purchased===false));
 console.log('PASS child cannot read reservation or purchase status');
 for(const table of ['family_budget_entries','family_budget_months']) assert.equal(ok(await child.from(table).select('*')).length,0);
 const personal=ok(await parent.from('family_budget_entries').select('id').eq('owner_member_id',f.parent));
 assert(personal.length>0,'fixture must contain a personal budget');
 assert.equal(ok(await second.from('family_budget_entries').select('id').in('id',personal.map(r=>r.id))).length,0);
 console.log('PASS child excluded from adult budgets and other parent excluded from private entries');
 const notifications=ok(await child.from('notifications').select('recipient_member_id'));
 assert(notifications.every(n=>n.recipient_member_id===f.child));
 console.log('PASS child notification inbox only returns its own recipient');
 const settings=await fetch('https://jnthaerbttgxnphkolvj.supabase.co/auth/v1/settings',{headers:{apikey:key}}).then(r=>r.json());
 assert.equal(settings.mailer_autoconfirm,false);
 assert.equal(settings.external.anonymous_users,false);
 console.log('PASS confirmation required and anonymous signup disabled');
} catch {
 console.error('FAIL family access regression; inspect the assertion locally without logging credentials');
 process.exitCode=1;
} finally {for(const client of clients) await client.auth.signOut({scope:'local'});}
