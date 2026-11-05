const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');

function handler(path, start, end, env) {
  const source = readFileSync(path, 'utf8');
  const text = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
  const js = stripTypeScriptTypes(text);
  return new Function(...Object.keys(env), `${js}; return ${start.match(/function (\w+)/)[1]};`)(...Object.values(env));
}
const event = { preventDefault() {} };

test('login releases its lock and keeps the form usable after a rejected request', async () => {
  const state = {}, lock = { current: false };
  const submit = handler('app/login/page.tsx', 'async function handleSubmit', '\n  return (', {
    submitLock: lock, setLoading: value => state.loading = value, setMessage: value => state.message = value,
    mode: 'login', email: ' me@example.com ', password: 'password',
    supabase: { auth: { signInWithPassword: async ({ email }) => { assert.equal(email, 'me@example.com'); throw Error('offline'); } } },
  });
  await submit(event);
  assert.equal(state.loading, false);
  assert.equal(lock.current, false);
  assert.match(state.message, /Kunde inte ansluta/);
});

test('family setup rejects whitespace names before creating anything', async () => {
  const state = {};
  const submit = handler('app/familj/page.tsx', 'async function handleSubmit', '\n  if (loading)', {
    submitLock: { current: false }, loadFailed: false, name: '  ', familyName: 'Familjen',
    setMessage: value => state.message = value,
  });
  await submit(event);
  assert.match(state.message, /Fyll i/);
});

test('family setup prevents duplicate submissions and recovers from network failure', async () => {
  const state = {}, lock = { current: false }; let calls = 0, reject;
  const submit = handler('app/familj/page.tsx', 'async function handleSubmit', '\n  if (loading)', {
    submitLock: lock, loadFailed: false, name: ' Adrian ', familyName: ' Familjen ',
    setMessage: value => state.message = value, setSaving: value => state.saving = value,
    supabase: { rpc: async (name, args) => { calls++; assert.equal(args.member_name, 'Adrian'); return new Promise((_, r) => reject = r); } },
  });
  const pending = submit(event); await submit(event);
  assert.equal(calls, 1); reject(Error('offline')); await pending;
  assert.equal(state.saving, false); assert.equal(lock.current, false);
  assert.match(state.message, /Kunde inte skapa/);
});

test('task completion releases its button after a rejected update', async () => {
  const state = {};
  const toggle = handler('app/uppgifter/page.tsx', 'async function toggle', '\n function beginEdit', {
    workingId: null, member: { id: 'child', role: 'barn' },
    setWorkingId: value => state.working = value, setError: value => state.error = value,
    supabase: { from: () => ({ update: () => ({ eq: async () => { throw Error('offline'); } }) }) },
  });
  await toggle({ id: 'task', assigned_member_id: 'child', completed_at: null });
  assert.equal(state.working, null); assert.match(state.error, /Kunde inte uppdatera/);
});

test('chat preserves text and releases sending state when send cannot be confirmed', async () => {
  const state = {};
  const send = handler('app/chat/page.tsx', 'async function send', '\n  async function removeMessage', {
    member: { id: 'me', family_id: 'family' }, body: 'Hej familjen', sending: false,
    setSending: value => state.sending = value, setError: value => state.error = value,
    setBody: value => state.body = value,
    supabase: { from: () => ({ insert: async () => { throw Error('offline'); } }) },
  });
  await send(event);
  assert.equal(state.sending, false); assert.equal(state.body, undefined);
  assert.match(state.error, /Kunde inte bekräfta/);
});
