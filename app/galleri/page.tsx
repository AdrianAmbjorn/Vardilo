"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";

type Photo={id:string;image_url:string;caption:string|null;uploaded_by_member_id:string;created_at:string};
type Member={id:string;family_id:string;display_name:string};
function validImageUrl(value:string){try{const u=new URL(value);return (u.protocol==="https:"||u.protocol==="http:")&&Boolean(u.hostname)}catch{return false}}
export default function GalleryPage(){
 const s=useMemo(()=>createClient(),[]);
 const [member,setMember]=useState<Member|null>(null);
 const [photos,setPhotos]=useState<Photo[]>([]);
 const [url,setUrl]=useState("");
 const [caption,setCaption]=useState("");
 const [busy,setBusy]=useState(false);
 const [removingId,setRemovingId]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 async function load(){
  const {data:u,error:authError}=await s.auth.getUser();
  if(authError||!u.user){setError("Logga in för att visa familjens bilder.");setLoading(false);return}
  const {data:me,error:memberError}=await s.from("family_members").select("id,family_id,display_name").eq("user_id",u.user.id).maybeSingle();
  if(memberError||!me){setError("Kunde inte hitta din familj.");setLoading(false);return}
  setMember(me);
  const {data:p,error:photoError}=await s.from("family_gallery_photos").select("id,image_url,caption,uploaded_by_member_id,created_at").eq("family_id",me.family_id).order("created_at",{ascending:false});
  if(photoError)setError("Kunde inte hämta bilder: "+photoError.message);
  else{setPhotos(p??[]);setError("")}
  setLoading(false);
 }
 useEffect(()=>{void load()},[s]);
 async function add(){
  if(!member||busy)return;
  if(!validImageUrl(url.trim())){setError("Ange en giltig bildadress som börjar med https:// eller http://.");return}
  setBusy(true);setError("");setNotice("");
  const {error:e}=await s.from("family_gallery_photos").insert({family_id:member.family_id,uploaded_by_member_id:member.id,image_url:url.trim(),caption:caption.trim()||null});
  if(e)setError("Kunde inte lägga till bilden: "+e.message);
  else{setUrl("");setCaption("");await load();setNotice("Bilden har lagts till.")}
  setBusy(false);
 }
 async function remove(photo:Photo){
  if(!member||removingId||photo.uploaded_by_member_id!==member.id)return;
  if(!window.confirm("Vill du ta bort bilden från familjens galleri?"))return;
  setRemovingId(photo.id);setError("");setNotice("");
  const {error:e}=await s.from("family_gallery_photos").delete().eq("id",photo.id).eq("family_id",member.family_id).eq("uploaded_by_member_id",member.id);
  if(e)setError("Kunde inte ta bort bilden: "+e.message);
  else{await load();setNotice("Bilden har tagits bort.")}
  setRemovingId(null);
 }
 return <main className="section-shell"><header className="section-header"><div><p className="eyebrow">VARDILO</p><h1>Galleri</h1><p className="muted">Familjens bilder och minnen.</p></div><Link className="secondary" href="/">Hem</Link></header>
 <section className="section-card" style={{paddingBottom:22}}>
  <div className="family-admin-form" style={{display:"grid",gap:12}}>
   <label className="family-admin-field"><span>Bildadress</span><input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://exempel.se/bild.jpg"/></label>
   <label className="family-admin-field"><span>Beskrivning</span><input value={caption} maxLength={200} onChange={e=>setCaption(e.target.value)} placeholder="T.ex. Familjekväll"/></label>
   <div><button type="button" className="primary" onClick={()=>void add()} disabled={busy||!url.trim()}>{busy?"Sparar...":"+ Lägg till bild"}</button></div>
   <p className="muted">Klistra in en länk till en bild. Direkt uppladdning kommer senare.</p>
   {error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}
   {notice&&<p role="status" style={{color:"var(--text)"}}>{notice}</p>}
  </div>
  {loading?<p className="muted" style={{padding:22}}>Laddar bilder...</p>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16,padding:"22px"}}>{photos.map(p=><figure className="card" key={p.id} style={{margin:0,padding:10,minWidth:0}}><img src={p.image_url} alt={p.caption||"Familjebild"} loading="lazy" style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:10}}/><figcaption style={{padding:"10px 4px 2px",color:"var(--text)",overflowWrap:"anywhere"}}>{p.caption||"Familjebild"}</figcaption><small style={{color:"var(--muted)"}}>{new Intl.DateTimeFormat("sv-SE",{day:"numeric",month:"short",year:"numeric"}).format(new Date(p.created_at))}</small>{p.uploaded_by_member_id===member?.id&&<div style={{marginTop:8}}><button type="button" className="secondary" disabled={removingId!==null} onClick={()=>void remove(p)}>{removingId===p.id?"Tar bort...":"Ta bort"}</button></div>}</figure>)}</div>}
  {!loading&&!photos.length&&<p className="muted" style={{padding:"0 22px"}}>Inga bilder ännu.</p>}
 </section></main>;
}
