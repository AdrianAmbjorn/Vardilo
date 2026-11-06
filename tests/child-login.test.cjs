const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const identity = stripTypeScriptTypes(readFileSync('lib/child-login.ts', 'utf8')).replaceAll('export ', '');
const { childLoginEmail, validChildUsername } = new Function(`${identity}; return { childLoginEmail, validChildUsername };`)();

test('child identity is normalized, distinct per parent and username, and hides the real email', async () => {
  const id = await childLoginEmail(' Parent@Example.com ', ' Alice ');
  assert.equal(id, await childLoginEmail('parent@example.com', 'alice'));
  assert.notEqual(id, await childLoginEmail('other@example.com', 'alice'));
  assert.notEqual(id, await childLoginEmail('parent@example.com', 'bob'));
  assert.match(id, /^[a-f0-9]{64}@children\.vardilo\.invalid$/);
  assert(!id.includes('parent'));
  assert(validChildUsername(' Alice_2 '));
  for (const bad of ['ab', '<script>', 'x@y.com', 'a'.repeat(31)]) assert(!validChildUsername(bad));
  assert.equal(readFileSync('lib/child-login.ts','utf8'), readFileSync('supabase/functions/manage-child-login/identity.ts','utf8'));
});

function edge(scenario = {}) {
  const calls = []; let handler;
  const admin = {
    auth: {
      getUser: async () => ({ data: { user: scenario.invalidToken ? null : { id: 'parent-user', email: 'parent@example.com' } }, error: scenario.invalidToken ? Error() : null }),
      admin: {
        createUser: async args => { calls.push(['create', args]); return { data: { user: { id: 'new-child-user' } }, error: null }; },
        updateUserById: async (id, args) => { calls.push(['reset', id, args]); return { error: null }; },
        deleteUser: async id => { calls.push(['cleanup', id]); return { error: null }; },
      },
    },
    from: table => {
      const filters = {}; const query = { select() { return query; }, eq(k,v) { filters[k]=v; return query; }, single() { return result(); }, maybeSingle() { return result(); } };
      async function result() {
        calls.push(['query', table, {...filters}]);
        if(table==='family_permissions') return { data: { can_manage_members: !scenario.noPermission } };
        if(table==='family_child_logins') return { data: scenario.notOwner ? null : { child_user_id:'existing-child' } };
        if(filters.user_id) return { data: { id:'guardian',family_id:'family',role: scenario.childActor ? 'barn' : 'admin' } };
        assert.equal(filters.family_id,'family'); assert.equal(filters.role,'barn');
        return { data: scenario.foreignChild ? null : { id:filters.id,display_name:'Barn',role:'barn',user_id: scenario.existing ? 'existing-child' : null } };
      }
      return query;
    },
    rpc: async (name,args) => { calls.push(['link', name,args]); return { error: scenario.linkFail ? Error('race') : null }; },
  };
  let source=readFileSync('supabase/functions/manage-child-login/index.ts','utf8').replace(/^import .*;\n/gm,'');
  source=stripTypeScriptTypes(source);
  new Function('createClient','Deno','childLoginEmail','normalizeChildUsername','validChildUsername',source)(()=>admin,{ env:{get:()=> 'test'},serve:fn=>handler=fn },childLoginEmail,v=>v.trim().toLowerCase(),validChildUsername);
  return { calls, run: (body, token='valid') => handler(new Request('https://example.test', { method:'POST', headers: token ? {Authorization:`Bearer ${token}`,'Content-Type':'application/json'} : {'Content-Type':'application/json'},body:JSON.stringify(body) })) };
}
const createBody = { action:'create',memberId:'11111111-1111-4111-8111-111111111111',username:'Alice',guardianConfirmed:true,password:'long-child-password' };

test('anonymous, invalid session, child actor, foreign-family child are denied', async () => {
  for (const [scenario,token,status] of [[{},'',401],[{invalidToken:true},'bad',401],[{childActor:true},'valid',403],[{foreignChild:true},'valid',403]]) {
    const e=edge(scenario); assert.equal((await e.run(createBody,token)).status,status);
    assert(!e.calls.some(call=>['create','reset','link'].includes(call[0])));
  }
});

test('create links a separate child Auth account and only sends the child password to Auth', async () => {
  const e=edge(); const response=await e.run(createBody); assert.equal(response.status,200);
  const created=e.calls.find(call=>call[0]==='create')[1];
  assert.equal(created.password,createBody.password); assert.equal(created.email,await childLoginEmail('parent@example.com','alice'));
  const args=e.calls.find(call=>call[0]==='link')[2];
  assert.equal(args.p_child_user_id,'new-child-user'); assert.equal(args.p_guardian_user_id,'parent-user');
  assert.equal(args.p_member_id,createBody.memberId); assert.equal(args.p_username,'alice');
  assert(!JSON.stringify(args).includes(createBody.password));
});

test('a conflicting link cleans up the newly created account instead of overwriting a child', async () => {
  const e=edge({linkFail:true}); assert.equal((await e.run(createBody)).status,409);
  assert(e.calls.some(call=>call[0]==='cleanup'&&call[1]==='new-child-user'));
});

test('existing child accounts cannot be replaced, and only the owning parent can reset', async () => {
  const e=edge({existing:true}); assert.equal((await e.run(createBody)).status,409);
  assert(!e.calls.some(call=>call[0]==='create'));
  const denied=edge({existing:true,notOwner:true}); assert.equal((await denied.run({...createBody,action:'reset'})).status,403);
  assert(!denied.calls.some(call=>call[0]==='reset'));
  const allowed=edge({existing:true}); assert.equal((await allowed.run({...createBody,action:'reset'})).status,200);
  assert.deepEqual(allowed.calls.find(call=>call[0]==='reset').slice(1),['existing-child',{password:createBody.password}]);
});

test('short passwords are rejected without creating an account', async () => {
  const e=edge(); assert.equal((await e.run({...createBody,password:'123'})).status,400);
  assert(!e.calls.some(call=>call[0]==='create'));
});

test('a child account is not created without an explicit guardian acknowledgement',async()=>{const e=edge();assert.equal((await e.run({...createBody,guardianConfirmed:false})).status,400);assert(!e.calls.some(call=>call[0]==='create'))});
