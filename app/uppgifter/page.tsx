"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";

type Member={id:string;display_name:string};
type Task={id:string;title:string;assigned_member_id:string|null;xp:number;due_at:string|null;completed_at:string|null};
function dateLabel(value:string){return new Intl.DateTimeFormat("sv-SE",{day:"numeric",month:"short",year:"numeric"}).format(new Date(value))}
function localDate(value:string){const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}

export default function TasksPage(){
 const supabase=useMemo(()=>createClient(),[]);
 const [member,setMember]=useState<{id:string;family_id:string}|null>(null);
 const [members,setMembers]=useState<Member[]>([]);
 const [tasks,setTasks]=useState<Task[]>([]);
 const [title,setTitle]=useState("");
 const [assigned,setAssigned]=useState("");
 const [xp,setXp]=useState("20");
 const [dueDate,setDueDate]=useState("");
 const [showCompleted,setShowCompleted]=useState(true);
 const [filterMember,setFilterMember]=useState("all");
 const [saving,setSaving]=useState(false);
 const [workingId,setWorkingId]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);

 async function load(){
  const {data:u,error:authError}=await supabase.auth.getUser();
  if(authError||!u.user){setError("Logga in för att se uppgifterna.");setLoading(false);return}
  const {data:m,error:memberError}=await supabase.from("family_members").select("id,family_id").eq("user_id",u.user.id).maybeSingle();
  if(memberError||!m){setError("Kunde inte hitta din familj.");setLoading(false);return}
  setMember(m);
  const [ms,ts]=await Promise.all([
   supabase.from("family_members").select("id,display_name").eq("family_id",m.family_id).order("created_at"),
   supabase.from("family_tasks").select("id,title,assigned_member_id,xp,due_at,completed_at").eq("family_id",m.family_id).order("created_at",{ascending:false})
  ]);
  if(ms.error||ts.error)setError(ms.error?.message??ts.error?.message??"Kunde inte läsa uppgifterna.");
  else{setMembers(ms.data??[]);setTasks(ts.data??[]);setError("")}
  setLoading(false);
 }
 useEffect(()=>{void load()},[supabase]);
 async function add(){
  if(!member||!title.trim()||saving)return;
  setSaving(true);setError("");
  const {data:u}=await supabase.auth.getUser();
  if(!u.user){setError("Du behöver logga in igen.");setSaving(false);return}
  const {error:e}=await supabase.from("family_tasks").insert({
   family_id:member.family_id,title:title.trim(),assigned_member_id:assigned||null,
   xp:Math.max(0,Math.floor(Number(xp)||0)),
   due_at:dueDate?new Date(`${dueDate}T12:00:00`).toISOString():null,
   created_by:u.user.id
  });
  if(e)setError("Kunde inte spara uppgiften: "+e.message);
  else{setTitle("");setAssigned("");setXp("20");setDueDate("");await load()}
  setSaving(false);
 }
 async function toggle(task:Task){
  if(workingId)return;
  setWorkingId(task.id);setError("");
  const {error:e}=await supabase.from("family_tasks").update({completed_at:task.completed_at?null:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",task.id);
  if(e)setError("Kunde inte uppdatera uppgiften: "+e.message);else await load();
  setWorkingId(null);
 }
 const visible=tasks.filter(t=>(showCompleted||!t.completed_at)&&(filterMember==="all"||(filterMember==="family"?t.assigned_member_id===null:t.assigned_member_id===filterMember))).sort((a,b)=>{
  if(Boolean(a.completed_at)!==Boolean(b.completed_at))return a.completed_at?1:-1;
  if(a.due_at&&!b.due_at)return -1;
  if(!a.due_at&&b.due_at)return 1;
  return a.due_at&&b.due_at?new Date(a.due_at).getTime()-new Date(b.due_at).getTime():0;
 });
 const total=tasks.reduce((s,t)=>s+(t.completed_at?t.xp:0),0);
 const completed=tasks.filter(t=>t.completed_at).length;
 const leaderboard=members.map(m=>({id:m.id,name:m.display_name,xp:tasks.filter(t=>t.completed_at&&t.assigned_member_id===m.id).reduce((sum,t)=>sum+t.xp,0),done:tasks.filter(t=>t.completed_at&&t.assigned_member_id===m.id).length,open:tasks.filter(t=>!t.completed_at&&t.assigned_member_id===m.id).length})).sort((a,b)=>b.xp-a.xp||a.name.localeCompare(b.name,"sv"));
 return <main className="section-shell"><header className="section-header"><div><p className="eyebrow">VARDILO</p><h1>Uppgifter</h1><p className="muted">Ansvar, uppgifter och XP för familjen.</p></div><Link className="secondary" href="/">Hem</Link></header>
 <section className="section-card">
 <div className="family-admin-form" style={{display:"grid",gap:12}}>
  <label className="family-admin-field"><span>Ny uppgift</span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="T.ex. Plocka undan efter middag"/></label>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
   <label className="family-admin-field"><span>Ansvarig</span><select value={assigned} onChange={e=>setAssigned(e.target.value)}><option value="">Hela familjen</option>{members.map(m=><option key={m.id} value={m.id}>{m.display_name}</option>)}</select></label>
   <label className="family-admin-field"><span>Klart senast (valfritt)</span><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label>
   <label className="family-admin-field"><span>XP</span><input type="number" min="0" step="1" value={xp} onChange={e=>setXp(e.target.value)}/></label>
  </div>
  <div><button className="primary" type="button" onClick={add} disabled={saving||!title.trim()}>{saving?"Sparar...":"+ Lägg till uppgift"}</button></div>
  {error&&<p role="alert" style={{color:"#b42318",fontSize:13}}>{error}</p>}
 </div>
 <div style={{padding:"20px 22px 4px"}}><h3 style={{color:"var(--text)",marginBottom:12}}>XP per familjemedlem</h3><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>{leaderboard.map(person=><div key={person.id} style={{border:"1px solid var(--line)",borderRadius:12,padding:12,background:"#edf7ef",color:"var(--text)"}}><strong style={{display:"block",color:"var(--text)",fontSize:13}}>{person.name}</strong><strong style={{display:"block",fontSize:22,color:"var(--text)",marginTop:5}}>{person.xp} XP</strong><small style={{color:"var(--muted)"}}>{person.done} klara · {person.open} kvar</small></div>)}</div></div>
 <div className="card-heading" style={{margin:"24px 22px 12px",gap:12,flexWrap:"wrap"}}><div><h3>Familjens uppgifter</h3><p className="muted">{completed} av {tasks.length} klara · {total} XP intjänade</p></div><div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}><label style={{display:"grid",gap:4,fontSize:12,color:"var(--text)"}}>Visa uppgifter för<select aria-label="Filtrera uppgifter efter person" value={filterMember} onChange={e=>setFilterMember(e.target.value)} style={{border:"1px solid var(--line)",borderRadius:8,padding:"7px 10px",background:"white",color:"var(--text)"}}><option value="all">Alla</option><option value="family">Hela familjen</option>{members.map(m=><option key={m.id} value={m.id}>{m.display_name}</option>)}</select></label><label style={{display:"flex",alignItems:"center",gap:7,fontSize:12,color:"var(--text)"}}><input type="checkbox" checked={showCompleted} onChange={e=>setShowCompleted(e.target.checked)}/> Visa klara</label></div></div>
 {loading?<p className="muted" style={{padding:22}}>Laddar uppgifter...</p>:visible.map(t=>{
  const who=members.find(m=>m.id===t.assigned_member_id);
  const overdue=Boolean(t.due_at&&!t.completed_at&&localDate(t.due_at)<localDate(new Date().toISOString()));
  return <div className="section-row" key={t.id}><div><strong style={{color:"var(--text)",textDecoration:t.completed_at?"line-through":"none"}}>{t.title}</strong><p>{who?.display_name??"Hela familjen"} · +{t.xp} XP</p>{t.due_at&&<p style={{color:overdue?"#b42318":"var(--muted)"}}>{overdue?"Försenad · ":"Klart senast "}{dateLabel(t.due_at)}</p>}</div><button className="secondary" type="button" disabled={workingId!==null} onClick={()=>void toggle(t)}>{workingId===t.id?"Sparar...":t.completed_at?"Ångra":"Markera klar"}</button></div>;
 })}
 {!loading&&!visible.length&&<p className="muted" style={{padding:22}}>{tasks.length?"Inga uppgifter matchar filtret.":"Inga uppgifter ännu."}</p>}
 </section></main>;
}
