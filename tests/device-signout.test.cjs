const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {stripTypeScriptTypes}=require('node:module');
const code=stripTypeScriptTypes(readFileSync('lib/device-signout.ts','utf8')).replace('export ','');
const signOut=new Function(`${code};return signOutOnThisDevice`)();
function fixture(subscription){const calls=[];return {calls,client:{auth:{signOut:async options=>{calls.push(options.scope);return {error:null}}}},worker:{getRegistration:async()=>({pushManager:{getSubscription:async()=>subscription}})}}}
test('device logout cancels push before ending only the local session',async()=>{const h=fixture({unsubscribe:async()=>{h.calls.push('unsubscribe');return true}});await signOut(h.client,h.worker);assert.deepEqual(h.calls,['unsubscribe','local'])});
test('logout works on browsers without an active push subscription',async()=>{for(const worker of [undefined,{getRegistration:async()=>undefined},fixture(null).worker]){const h=fixture(null);await signOut(h.client,worker);assert.deepEqual(h.calls,['local'])}});
test('an existing push subscription that cannot be removed blocks account switching',async()=>{for(const unsubscribe of [async()=>false,async()=>{throw Error('offline')}]){const h=fixture({unsubscribe});await assert.rejects(signOut(h.client,h.worker));assert.deepEqual(h.calls,[])}});
test('already removed subscriptions do not block logout',async()=>{let reads=0;const h=fixture(null);h.worker.getRegistration=async()=>({pushManager:{getSubscription:async()=>++reads===1?{unsubscribe:async()=>false}:null}});await signOut(h.client,h.worker);assert.deepEqual(h.calls,['local'])});
test('a sign-out API failure remains visible to the caller',async()=>{const h=fixture(null);h.client.auth.signOut=async()=>({error:Error('offline')});assert((await signOut(h.client,h.worker)).error)});

test("logout closes already displayed notifications on a shared device",async()=>{const h=fixture(null);h.worker.getRegistration=async()=>({pushManager:{getSubscription:async()=>null},getNotifications:async()=>[{close:()=>h.calls.push("close")}]});await signOut(h.client,h.worker);assert.deepEqual(h.calls,["close","local"])});
