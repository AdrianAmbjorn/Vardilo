const {test}=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(readFileSync('lib/app-navigation.ts','utf8')).replaceAll('export ','');const navigationForRole=new Function(`${source};return navigationForRole`)();
test('child navigation always includes wishlists, tasks, chat and their savings plan',()=>{
 const links=navigationForRole('barn').map(item=>item[2]);for(const href of ['/onskelistor','/uppgifter','/chat','/sparande'])assert(links.includes(href));assert(!links.includes('/budget'));
});
test('adult navigation shows parent budgets only to parents and Admin',()=>{
 for(const role of ['admin','förälder']){const links=navigationForRole(role).map(item=>item[2]);assert(links.includes('/budget'));assert(!links.includes('/sparande'));}
 for(const role of ['familj',undefined])assert(!navigationForRole(role).some(item=>item[2]==='/budget'));
});
