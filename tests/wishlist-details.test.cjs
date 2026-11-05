const {test}=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');const {stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(readFileSync('lib/wishlist-details.ts','utf8')).replaceAll('export ','');const helpers=new Function(`${source};return {wishUrl,wishPrice,safeWishUrl,formatWishPrice};`)();

test('Swedish prices accept comma, decimal point and grouping spaces without treating blank as zero',()=>{
 assert.equal(helpers.wishPrice('1 299,50'),1299.5);assert.equal(helpers.wishPrice('1\u00a0299,50'),1299.5);assert.equal(helpers.wishPrice('299.50'),299.5);assert.equal(helpers.wishPrice('  '),null);assert.equal(helpers.wishPrice('0'),0);
 for(const bad of ['-1','299,999','1e5','1.299,50','gratis','999999999'])assert.throws(()=>helpers.wishPrice(bad));
});
test('wish links only accept web URLs without embedded credentials',()=>{
 assert.equal(helpers.wishUrl(' www.example.com/gift '),'https://www.example.com/gift');assert.equal(helpers.wishUrl(''),null);
 for(const bad of ['javascript:alert(1)','data:text/html,test','file:///tmp/file','https://user:password@example.com']){assert.throws(()=>helpers.wishUrl(bad));assert.equal(helpers.safeWishUrl(bad),null)}
 assert.match(helpers.formatWishPrice(299.5),/299,50/);
});
function handler(name,end,env){const s=readFileSync('app/onskelistor/page.tsx','utf8');const start=s.indexOf(`  function ${name}(`);const code=stripTypeScriptTypes(s.slice(start,s.indexOf(end,start)));return new Function(...Object.keys(env),`${code};return ${name};`)(...Object.values(env))}
const event={preventDefault(){}};
test('adding a wish stores title, normalized link and price and clears drafts only after success',async()=>{
 let pending,inserted,next,cleared=0;
 const env={selected:{id:'list',items:[]},item:' A book ',url:'www.example.com/book',price:'199,50',editing:null,...helpers,run:action=>{pending=action()},setSelected:value=>next=value,setItem:()=>cleared++,setUrl:()=>cleared++,setPrice:()=>cleared++,supabase:{from:()=>({insert:payload=>{inserted=payload;return {select:()=>({single:async()=>({data:{id:'wish',...payload,purchased:false},error:null})})}}})}};
 handler('addItem','  function beginEdit',env)(event);await pending;
 assert.equal(inserted.title,'A book');assert.equal(inserted.url,'https://www.example.com/book');assert.equal(inserted.price,199.5);assert.equal(cleared,3);assert.equal(next.items.length,1);
});
test('failed add keeps all entered fields',async()=>{
 let pending,cleared=0;
 const env={selected:{id:'list',items:[]},item:'Book',url:'',price:'',editing:null,...helpers,run:action=>{pending=action()},setSelected:()=>cleared++,setItem:()=>cleared++,setUrl:()=>cleared++,setPrice:()=>cleared++,supabase:{from:()=>({insert:()=>({select:()=>({single:async()=>({error:{message:'denied'}})})})})}};
 handler('addItem','  function beginEdit',env)(event);await assert.rejects(pending,/Din text finns kvar/);assert.equal(cleared,0);
});
test('editing a wish scopes the write to its list and preserves the other wishes',async()=>{
 let pending,payload,filters={},next,editing='wish';const other={id:'other',title:'Other',purchased:true};
 const q={update(value){payload=value;return q},eq(k,v){filters[k]=v;return q},select(){return q},single:async()=>({data:{id:'wish',...payload,purchased:false},error:null})};
 const env={selected:{id:'list',items:[{id:'wish',title:'Old'},other]},editing,editTitle:' New ',editUrl:'https://example.com',editPrice:'99,90',...helpers,run:action=>{pending=action()},setSelected:value=>next=value,setEditing:value=>editing=value,supabase:{from:()=>q}};
 handler('saveEdit','  function reserve',env)(event);await pending;assert.deepEqual(filters,{id:'wish',wishlist_id:'list'});assert.equal(payload.price,99.9);assert.equal(next.items[1],other);assert.equal(editing,null);
});

function openHandler(env){const s=readFileSync('app/onskelistor/page.tsx','utf8');const start=s.indexOf('  async function open(');const code=stripTypeScriptTypes(s.slice(start,s.indexOf('  function addList',start)));return new Function(...Object.keys(env),`${code};return open;`)(...Object.values(env))}
test('child opening a wishlist never fetches or retains reservation details',async()=>{
 const tables=[];let reservations,selected;
 const env={member:{id:'child',role:'barn'},selected:null,setSelected:value=>selected=value,setReservations:value=>reservations=value,setEditing(){},setItem(){},setUrl(){},setPrice(){},supabase:{from:table=>{tables.push(table);return {select:()=>({eq:()=>({order:async()=>({data:[{id:'wish',title:'Book',url:null,price:99,purchased:false}],error:null})})})}}}};
 await openHandler(env)({id:'list',member_id:'child',title:'Birthday'});assert.deepEqual(tables,['family_wishlist_items']);assert.deepEqual(reservations,{});assert.equal(selected.items[0].price,99);
});
test('an adult can reserve and undo their own reservation, refreshing status after each action',async()=>{
 for(const mine of [false,true]){
  let pending,called,refreshed=false;const env={member:{id:'adult',role:'admin'},selected:{id:'list',member_id:'adult'},reservations:mine?{wish:'adult'}:{},run:action=>{pending=action()},open:async()=>{refreshed=true},supabase:{rpc:async(name,args)=>{called=[name,args];return {error:null}}}};
  handler('reserve','  function toggle',env)({id:'wish'});await pending;assert.equal(called[0],mine?'unreserve_wishlist_item':'reserve_wishlist_item');assert.deepEqual(called[1],{p_item_id:'wish'});assert(refreshed);
 }
});
