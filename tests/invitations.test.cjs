const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const { readFileSync } = require('node:fs');
const source=stripTypeScriptTypes(readFileSync('lib/login-destination.ts','utf8')).replace('export ','');
const destination=new Function(`${source};return loginDestination;`)();

test('an invitation survives login and confirmation redirects',()=>{
 const path='/inbjudan?kod='+'a'.repeat(64);
 assert.equal(destination('?next='+encodeURIComponent(path)),path);
});
test('login only accepts the supported invitation destination',()=>{
 for(const path of ['https://evil.example','//evil.example','/inbjudan?kod=short','/familj/admin','/inbjudan?kod='+'a'.repeat(64)+'&next=https://evil.example'])assert.equal(destination('?next='+encodeURIComponent(path)),'/familj');
 assert.equal(destination(''),'/familj');
});
