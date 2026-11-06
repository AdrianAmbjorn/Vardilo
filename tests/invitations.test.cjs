const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const { readFileSync } = require('node:fs');
const source=stripTypeScriptTypes(readFileSync('lib/login-destination.ts','utf8')).replaceAll('export ','');
const destinations=new Function(`${source};return {loginDestination,invitationContinuation,recoveryDestination};`)();

test('an invitation survives login and confirmation redirects',()=>{
 const path='/inbjudan?kod='+'a'.repeat(64);
 assert.equal(destination('?next='+encodeURIComponent(path)),path);
});
test('login only accepts the supported invitation destination',()=>{
 for(const path of ['https://evil.example','//evil.example','/inbjudan?kod=short','/familj/admin','/inbjudan?kod='+'a'.repeat(64)+'&next=https://evil.example'])assert.equal(destination('?next='+encodeURIComponent(path)),'/familj');
 assert.equal(destination(''),'/familj');
});

const destination=destinations.loginDestination;
const statusSource=stripTypeScriptTypes(readFileSync('lib/invitation-status.ts','utf8')).replaceAll('export ','');
const status=new Function(`${statusSource};return invitationStatus;`)();
const now=Date.parse('2026-11-05T12:00:00Z');
const invite={expires_at:'2026-11-12T12:00:00Z',accepted_at:null,revoked_at:null};
test('pending invitations expire exactly at the expiry time',()=>{
 assert.equal(status(invite,now),'pending');
 assert.equal(status(invite,Date.parse(invite.expires_at)),'expired');
});
test('accepted and revoked invitations keep their final status after expiry',()=>{
 assert.equal(status({...invite,accepted_at:'2026-11-06T12:00:00Z'},Date.parse('2027-01-01')),'accepted');
 assert.equal(status({...invite,revoked_at:'2026-11-06T12:00:00Z'},Date.parse('2027-01-01')),'revoked');
});
test('an invalid expiry is never treated as an active invitation',()=>{
 assert.equal(status({...invite,expires_at:'invalid'},now),'expired');
});

test('password recovery retains invitations but never carries untrusted redirects',()=>{const invite='/inbjudan?kod='+'b'.repeat(64);const search='?next='+encodeURIComponent(invite);for(const failed of [false,true]){const url=new URL(destinations.recoveryDestination(search,failed),'https://vardilo.vercel.app');assert.equal(url.pathname,'/losenord');assert.equal(url.searchParams.get('next'),invite);assert.equal(url.searchParams.get(failed?'error':'nytt'),failed?'expired':'1')}for(const next of ['https://evil.example','//evil.example','/inbjudan?kod=short','/inbjudan?kod='+'b'.repeat(64)+'&next=https://evil.example']){const search='?next='+encodeURIComponent(next);assert.equal(destinations.invitationContinuation(search),'');assert.equal(destinations.recoveryDestination(search),'/losenord?nytt=1')}});
