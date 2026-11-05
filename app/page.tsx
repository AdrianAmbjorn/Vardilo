"use client";

import Link from "next/link";
import { nextCalendarEvent } from "@/lib/next-calendar-event";
import { eventDateLabel } from "@/lib/event-date-label";
import { HomePreferences, HomeSection } from "./components/home-preferences";
import PersonalCountdown from "./components/personal-countdown";
import { canCompleteDailyTask, taskIsCurrent } from "@/lib/daily-tasks";
import { useStockholmDate } from "@/lib/use-stockholm-date";
import { navigationForRole } from "@/lib/app-navigation";
import HomeLists from "./components/home-lists";
import ChatNotificationBanner from "./components/chat-notification-banner";
import { greetingForHour } from "@/lib/greeting";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFamilyProfilePhotos } from "@/lib/use-family-profile-photos";
import { createClient } from "@/lib/supabase/client";

const weekDays=["Måndag","Tisdag","Onsdag","Torsdag","Fredag","Lördag","Söndag"];
type Member={id:string;family_id:string;display_name:string;role:string;xp_goal:number;xp_reward:string|null};
type CalendarEvent={ends_at:string|null;recurrence_enabled:boolean;recurrence_days:number[];recurrence_end_date:string|null;id:string;title:string;starts_at:string;all_day:boolean;location:string|null;target_member_id:string|null;responsible_member_id:string|null};
type MenuRow={id?:string;menu_date:string;meal:string|null};
type Task={scheduled_date?:string|null;id:string;title:string;assigned_member_id:string|null;xp:number;completed_at:string|null};
type Chat={id:string;member_id:string;body:string;created_at:string};
function HouseIcon(){return <svg className="house-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.7 12 3.8l8.5 6.9v8.1a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2v-8.1Z" fill="currentColor"/><path d="M9.1 20v-5.2h5.8V20" fill="white"/></svg>}
function dateKey(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function startOfWeek(date:Date){const d=new Date(date);const day=d.getDay();d.setDate(d.getDate()+(day===0?-6:1-day));d.setHours(0,0,0,0);return d}
function formatEventTime(v:string){return new Intl.DateTimeFormat("sv-SE",{hour:"2-digit",minute:"2-digit"}).format(new Date(v))}
export default function Home(){const router=useRouter();const supabase=useMemo(()=>createClient(),[]);const [member,setMember]=useState<Member|null>(null);const [members,setMembers]=useState<Member[]>([]);const [calendarEvents,setCalendarEvents]=useState<CalendarEvent[]>([]);const [calendarClock,setCalendarClock]=useState(0);const nextEvent=useMemo(()=>nextCalendarEvent(calendarEvents,new Date(calendarClock||Date.now())),[calendarEvents,calendarClock]);const [menu,setMenu]=useState<MenuRow[]>([]);const [tasks,setTasks]=useState<Task[]>([]);const [chats,setChats]=useState<Chat[]>([]);const [unread,setUnread]=useState(0);const [menuEnabled,setMenuEnabled]=useState(false);const [showMenuEditor,setShowMenuEditor]=useState(false);const [menuDraft,setMenuDraft]=useState<string[]>(Array(7).fill(""));const [showAdd,setShowAdd]=useState(false);const [showProfile,setShowProfile]=useState(false);const [loggingOut,setLoggingOut]=useState(false);const [loading,setLoading]=useState(true);const [savingMenu,setSavingMenu]=useState(false);const [removingTaskId,setRemovingTaskId]=useState<string|null>(null);const [completingTaskId,setCompletingTaskId]=useState<string|null>(null);const [homeError,setHomeError]=useState("");const [childXp,setChildXp]=useState(0);const [childOpen,setChildOpen]=useState(0);
const taskToday=useStockholmDate();
const navItems=navigationForRole(member?.role);
const menuSaveLock = useRef(false);
const [menuError, setMenuError] = useState("");
const profilePhotos = useFamilyProfilePhotos(supabase, member?.family_id);
const [greeting, setGreeting] = useState("Hej");
useEffect(() => {
  const updateGreeting = () => { setGreeting(greetingForHour(new Date().getHours())); setCalendarClock(Date.now()); };
  updateGreeting();
  const timer = window.setInterval(updateGreeting, 60_000);
  document.addEventListener("visibilitychange", updateGreeting);
  window.addEventListener("focus", updateGreeting);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", updateGreeting);
    window.removeEventListener("focus", updateGreeting);
  };
}, []);
const today=new Date();const weekStart=startOfWeek(today);const weekDates=weekDays.map((_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d});
async function readCalendar(familyId:string){
 const events:CalendarEvent[]=[];
 for(let offset=0;;offset+=500){
  const result=await supabase.from("calendar_events").select("id,title,starts_at,ends_at,all_day,location,target_member_id,responsible_member_id,recurrence_enabled,recurrence_days,recurrence_end_date").eq("family_id",familyId).order("starts_at").order("id").range(offset,offset+499);
  if(result.error)return {data:null,error:result.error};events.push(...(result.data??[]));if((result.data??[]).length<500)return {data:events,error:null};
 }
}
useEffect(()=>{let active=true;async function loadHome(){setLoading(true);try{const {data:a}=await supabase.auth.getUser();if(!a.user){router.replace("/login");return}const {data:me,error:memberError}=await supabase.from("family_members").select("id,family_id,display_name,role,xp_goal,xp_reward").eq("user_id",a.user.id).maybeSingle();if(memberError)throw memberError;if(!me){router.replace("/familj");return}if(me.role==="barn"){const {data:ownTasks}=await supabase.from("family_tasks").select("xp,completed_at,scheduled_date").eq("family_id",me.family_id).eq("assigned_member_id",me.id);if(active){setChildXp((ownTasks??[]).reduce((sum,t)=>sum+(t.completed_at?t.xp:0),0));setChildOpen((ownTasks??[]).filter(t=>taskIsCurrent(t,taskToday)&&!t.completed_at).length)}}const taskQuery=supabase.from("family_tasks").select("id,title,assigned_member_id,xp,completed_at,scheduled_date").eq("family_id",me.family_id).or(`scheduled_date.is.null,scheduled_date.eq.${taskToday}`);const [{data:ms,error:membersError},{data:events,error:eventsError},{data:menuRows,error:menuError},{data:ts,error:tasksError},{data:cs,error:chatError},{count,error:notificationsError}]=await Promise.all([supabase.from("family_members").select("id,family_id,display_name,role,xp_goal,xp_reward").eq("family_id",me.family_id).order("created_at"),readCalendar(me.family_id),supabase.from("family_meal_menu").select("id,menu_date,meal").eq("family_id",me.family_id).gte("menu_date",dateKey(weekStart)).lte("menu_date",dateKey(weekDates[6])).order("menu_date"),(me.role==="barn"?taskQuery.eq("assigned_member_id",me.id):taskQuery).order("completed_at",{ascending:true,nullsFirst:true}).order("created_at",{ascending:false}).limit(4),supabase.from("family_chat_messages").select("id,member_id,body,created_at").eq("family_id",me.family_id).order("created_at",{ascending:false}).limit(2),supabase.from("notifications").select("id",{count:"exact",head:true}).eq("recipient_member_id",me.id).is("read_at",null)]);if(!active)return;if(membersError||eventsError||menuError||tasksError||chatError||notificationsError)setHomeError("Delar av startsidan kunde inte laddas. Uppdatera appen för att försöka igen.");setMember(me);setMembers(ms??[]);setCalendarEvents((events??[]) as CalendarEvent[]);setMenu(menuRows??[]);setTasks((me.role==="barn"?(ts??[]).filter(t=>t.assigned_member_id===me.id):(ts??[])).slice(0,4));setChats((cs??[]).reverse());setUnread(count??0);setMenuEnabled((menuRows??[]).some(r=>r.meal?.trim()));setLoading(false)}catch{if(active)setHomeError("Kunde inte ladda startsidan. Försök att uppdatera appen.")}finally{if(active)setLoading(false)}}loadHome();return()=>{active=false}},[router,supabase,taskToday]);
useEffect(()=>{if(!member)return;const c=supabase.channel(`home-notifications-${member.id}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`recipient_member_id=eq.${member.id}`},()=>setUnread(v=>v+1)).on("postgres_changes",{event:"UPDATE",schema:"public",table:"notifications",filter:`recipient_member_id=eq.${member.id}`},()=>{supabase.from("notifications").select("id",{count:"exact",head:true}).eq("recipient_member_id",member.id).is("read_at",null).then(({count})=>setUnread(count??0))}).subscribe();return()=>{supabase.removeChannel(c)}},[member,supabase]);
const canEditMenu=member?.role==="admin"||member?.role==="förälder";useEffect(()=>{setMenuDraft(weekDates.map(d=>menu.find(r=>r.menu_date===dateKey(d))?.meal??""))},[menu]);
async function saveMenu(){
  if(!member||!canEditMenu||menuSaveLock.current)return;
  menuSaveLock.current=true;setSavingMenu(true);setMenuError("");
  try {
    const {data:u,error:authError}=await supabase.auth.getUser();
    if(authError||!u.user)throw new Error("Du behöver logga in igen för att spara menyn.");
    const rows=weekDates.map((d,i)=>({family_id:member.family_id,menu_date:dateKey(d),meal:menuDraft[i].trim()||null,created_by:u.user.id}));
    const {error}=await supabase.from("family_meal_menu").upsert(rows,{onConflict:"family_id,menu_date"});
    if(error)throw error;
    setMenu(rows.map(r=>({...r,id:menu.find(x=>x.menu_date===r.menu_date)?.id})));
    setMenuEnabled(rows.some(r=>r.meal));setShowMenuEditor(false);
  }catch{setMenuError("Kunde inte spara matmenyn. Dina ändringar finns kvar – försök igen.");}
  finally{menuSaveLock.current=false;setSavingMenu(false);}
}
async function completeMyTask(task:Task){if(!member||member.role!=="barn"||task.assigned_member_id!==member.id||task.completed_at||completingTaskId)return;if(task.scheduled_date&&!canCompleteDailyTask(task,member,taskToday))return;setCompletingTaskId(task.id);setHomeError("");const completedAt=new Date().toISOString();const {data,error}=await supabase.from("family_tasks").update({completed_at:completedAt,updated_at:completedAt}).eq("id",task.id).eq("family_id",member.family_id).eq("assigned_member_id",member.id).is("completed_at",null).select("id").maybeSingle();if(error)setHomeError("Kunde inte markera uppgiften klar: "+error.message);else if(!data)setHomeError("Uppgiften kunde inte uppdateras. Prova att ladda om sidan.");else{setTasks(current=>current.map(t=>t.id===task.id?{...t,completed_at:completedAt}:t));setChildXp(v=>v+task.xp);setChildOpen(v=>Math.max(0,v-1))}setCompletingTaskId(null)}
async function removeTask(task:Task){if(!member||removingTaskId)return;if(!window.confirm(`Ta bort uppgiften "${task.title}"?`))return;setRemovingTaskId(task.id);setHomeError("");const {error}=await supabase.from("family_tasks").delete().eq("id",task.id).eq("family_id",member.family_id);if(error)setHomeError("Kunde inte ta bort uppgiften: "+error.message);else setTasks(current=>current.filter(t=>t.id!==task.id));setRemovingTaskId(null)}
async function handleSignOut(){if(loggingOut)return;setLoggingOut(true);await supabase.auth.signOut();router.replace("/login");router.refresh()}
const displayName=member?.display_name??"familjen";const todayLabel=new Intl.DateTimeFormat("sv-SE",{weekday:"long",day:"numeric",month:"long"}).format(today);const nextEventTarget=nextEvent?.target_member_id?members.find(m=>m.id===nextEvent.target_member_id):null;const completedXp=tasks.reduce((s,t)=>s+(t.completed_at?t.xp:0),0);
return <main className="shell"><style>{`.event strong{color:var(--text)!important}.event p{color:var(--muted)!important}.tasks .task-row strong,.tasks .task-row p,.chat .message strong,.chat .message p{color:var(--text)!important}
.profile-photo { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; }
.profile:has(.profile-photo) { padding: 0; }
.profile-menu-link { display: block; padding: 9px; color: var(--accent); font-size: 13px; font-weight: 700; }
.mobile-home-menu { display: none; }
@media (max-width: 850px) {
  .mobile-home-menu { display: block; margin-bottom: 16px; }
  .mobile-home-menu summary { display: inline-flex; align-items: center; gap: 9px; padding: 4px 9px 4px 4px; cursor: pointer; list-style: none; font-weight: 700; }
  .mobile-home-menu summary::-webkit-details-marker { display: none; }
  .mobile-home-menu summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 12px; }
  .mobile-menu-house { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; background: var(--surface); color: var(--terracotta); border: 1px solid var(--line); }
  .mobile-home-menu nav { display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 4px; padding: 8px; margin-top: 6px; background: var(--text); border-radius: 14px; }
  .mobile-home-menu .nav-item { min-height: 44px; overflow-wrap: anywhere; }
}`}</style><aside className="sidebar"><Link href="/" className="brand"><div className="brand-mark" aria-label="Vardilo" style={{background:"var(--terracotta)",borderRadius:"50%",width:40,height:40,minWidth:40,padding:0,display:"grid",placeItems:"center",overflow:"hidden",boxShadow:"none",position:"relative",zIndex:1}}><HouseIcon/></div><div><strong>VARDILO</strong><span>Mer tid tillsammans.</span></div></Link><nav aria-label="Huvudmeny">{navItems.filter(([, , href]) => (href !== "/budget" || member?.role === "admin" || member?.role === "förälder") && (href !== "/sparande" || member?.role === "barn")).map(([title,subtitle,href],i)=><Link className={i===0?"nav-item active":"nav-item"} href={href} key={title}><span>{title}{title==="Notiser"&&unread>0?<b style={{marginLeft:7,background:"var(--red)",color:"white",borderRadius:20,padding:"2px 6px",fontSize:9}}>{unread}</b>:null}</span><small>{subtitle}</small></Link>)}</nav><div className="sidebar-footer"><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}><div className="family-label" style={{marginBottom:0}}>FAMILJEN</div><Link href="/familj/admin" aria-label="Lägg till eller hantera familjemedlemmar" title="Lägg till eller hantera familjemedlemmar" style={{display:"grid",placeItems:"center",width:30,height:30,borderRadius:9,border:"1px solid rgba(255,255,255,.3)",color:"#ffffff",textDecoration:"none",fontSize:22,fontWeight:700,lineHeight:1}}>+</Link></div>{members.map(p=><div className="member" key={p.id}><span className="avatar">{profilePhotos[p.id] ? <img className="profile-photo" src={profilePhotos[p.id]} alt="" /> : p.display_name.charAt(0).toUpperCase()}</span><span><strong>{p.display_name}</strong><small>{p.role}</small></span></div>)}</div></aside><section className="content">
  <details className="mobile-home-menu">
    <summary>
      <span className="mobile-menu-house"><HouseIcon /></span>
      <span>Meny{unread > 0 && ` · ${unread} olästa notiser`}</span>
    </summary>
    <nav aria-label="Huvudmeny">
      {navItems.filter(([, , href]) => (href !== "/budget" || member?.role === "admin" || member?.role === "förälder") && (href !== "/sparande" || member?.role === "barn")).map(([title, subtitle, href]) => (
        <Link
          className={href === "/" ? "nav-item active" : "nav-item"}
          aria-current={href === "/" ? "page" : undefined}
          key={href}
          href={href}
          onClick={event => event.currentTarget.closest("details")?.removeAttribute("open")}
        >
          <span>{title}{href === "/notiser" && unread > 0 && ` (${unread})`}</span>
          <small>{subtitle}</small>
        </Link>
      ))}
      <Link className="nav-item" href="/familj/admin"><span>Hantera familjen</span></Link>
    </nav>
  </details>
  <header className="topbar"><div><p className="eyebrow">{todayLabel}</p><h1>{greeting}, <span className="red-text">{displayName}.</span></h1></div><div className="profile-wrap"><button className="profile" type="button" aria-label="Öppna profilmeny" aria-expanded={showProfile} onClick={()=>setShowProfile(v=>!v)}>{member && profilePhotos[member.id] ? <img className="profile-photo" src={profilePhotos[member.id]} alt="" /> : displayName.charAt(0).toUpperCase()}</button>{showProfile&&<div className="profile-menu"><div className="profile-menu-name"><strong>{displayName}</strong><span>{member?.role}</span></div>{member && <Link className="profile-menu-link" href="/profil">Min profil</Link>}<button type="button" onClick={handleSignOut} disabled={loggingOut}>{loggingOut?"Loggar ut...":"Logga ut"}</button></div>}</div></header><div className="hero-actions"><button className="primary" type="button" onClick={()=>setShowAdd(v=>!v)}>+ Lägg till</button></div>{showAdd&&<div className="quick-add" role="dialog" aria-label="Lägg till"><strong>Vad vill du lägga till?</strong><div><Link href="/kalender">Händelse</Link><Link href="/uppgifter">Uppgift</Link><Link href="/hjalp">Hjälp</Link><Link href="/listor">Listpunkt</Link></div></div>}
<HomePreferences memberId={member?.id ?? null} isChild={member?.role === "barn"}>
<HomeSection id="budget">{(member?.role==="admin"||member?.role==="förälder")&&<section className="card" style={{marginTop:18}}><div className="card-heading"><h3>💰 Vår budget</h3><Link href="/budget">Öppna budgeten</Link></div><p className="muted">Månadens intäkter, kostnader och det ni delar på.</p></section>}</HomeSection>
<HomeSection id="meals"><section className="card meal-menu" style={{marginTop:18}}><div className="card-heading"><h3>Veckans mat</h3>{canEditMenu&&<button type="button" className="secondary" disabled={savingMenu} onClick={()=>{if(showMenuEditor){setMenuDraft(weekDates.map(d=>menu.find(r=>r.menu_date===dateKey(d))?.meal??""));setMenuError("")}setShowMenuEditor(v=>!v)}}>{showMenuEditor?"Stäng":"Redigera meny"}</button>}</div>{menuError&&<p role="alert" className="family-admin-error">{menuError}</p>}{!menuEnabled&&!showMenuEditor?<div><p className="muted">Ingen matmeny är upplagd ännu.</p>{canEditMenu&&<button type="button" className="primary" onClick={()=>setShowMenuEditor(true)}>Lägg till veckans meny</button>}</div>:showMenuEditor?<div className="family-admin-form">{weekDays.map((day,i)=><label className="family-admin-field" key={day}><span>{day}</span><input style={{color:"var(--red)"}} value={menuDraft[i]} onChange={e=>setMenuDraft(d=>d.map((v,j)=>j===i?e.target.value:v))} placeholder="T.ex. tacos"/></label>)}<div className="hero-actions"><button className="primary" type="button" onClick={saveMenu} disabled={savingMenu}>{savingMenu?"Sparar...":"Spara veckans meny"}</button><button className="secondary" type="button" disabled={savingMenu} onClick={()=>{setMenuDraft(weekDates.map(d=>menu.find(r=>r.menu_date===dateKey(d))?.meal??""));setMenuError("");setShowMenuEditor(false)}}>Avbryt</button></div></div>:<><div className="home-meal-today"><small>Idag</small><strong>{menuDraft[(today.getDay()+6)%7]||"Ingen maträtt planerad"}</strong></div><details className="home-meal-week"><summary>Hela veckans meny</summary><div className="grid" style={{gridTemplateColumns:"repeat(2,minmax(0,1fr))"}}>{weekDays.map((day,i)=><div className="event" key={day}><div className="time">{day.slice(0,3)}</div><div><strong style={{color:"var(--red)"}}>{menuDraft[i]||"–"}</strong><p>{dateKey(weekDates[i])===dateKey(today)?"Idag":""}</p></div></div>)}</div></details></>}</section></HomeSection>
<HomeSection id="chat"><section className="card home-chat"><div className="card-heading"><h3 className="home-chat-title">Familjechat <ChatNotificationBanner variant="badge" /></h3><Link href="/chat">Öppna</Link></div>{chats.slice(-1).map(c=>{const own=c.member_id===member?.id;const sender=members.find(m=>m.id===c.member_id)?.display_name??"Familjen";return <div className={`home-chat-preview${own?" home-chat-own":""}`} key={c.id}><span className="home-chat-sender">{own?"Du":sender}</span><p className="home-chat-bubble">{c.body}</p><time className="home-chat-time" dateTime={c.created_at}>{new Intl.DateTimeFormat("sv-SE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Stockholm"}).format(new Date(c.created_at))}</time></div>})}{!chats.length&&<div className="home-chat-empty"><p>Säg hej till familjen 👋</p><Link href="/chat">Skriv första meddelandet</Link></div>}</section></HomeSection>

<HomeSection id="countdown">{member && <PersonalCountdown memberId={member.id} />}</HomeSection>

<HomeSection id="xp">{member?.role==="barn"&&<section className="card" style={{marginTop:18,background:"#edf7ef",color:"#102a43"}}><div className="card-heading"><h3 style={{color:"#102a43"}}>Mina XP och mitt mål</h3><Link href="/uppgifter">Mina uppgifter</Link></div><strong style={{fontSize:28,color:"#102a43"}}>{childXp} / {member.xp_goal} XP</strong><div role="progressbar" aria-label="Mina XP mot målet" aria-valuemin={0} aria-valuemax={member.xp_goal} aria-valuenow={Math.min(childXp,member.xp_goal)} style={{height:12,borderRadius:12,background:"#d5e4da",overflow:"hidden",marginTop:12}}><div style={{height:"100%",width:`${Math.min(100,childXp/member.xp_goal*100)}%`,background:"#3f7d4a"}}/></div><p style={{margin:"10px 0 0",fontSize:13,color:"#102a43"}}>{childXp>=member.xp_goal?"Du har nått ditt mål!":`${member.xp_goal-childXp} XP kvar till målet`} · {childOpen} uppgifter kvar</p>{member.xp_reward&&<p style={{margin:"8px 0 0",fontSize:13,color:"#102a43"}}>Min belöning: <strong>{member.xp_reward}</strong></p>}</section>}</HomeSection>
<HomeSection id="calendar"><section className="card today"><div className="card-heading"><h3>Nästa händelse</h3><Link href="/kalender">Kalender</Link></div>{loading?<p className="muted">Laddar...</p>:nextEvent?<div className="event"><div className="time" style={{minWidth:0,whiteSpace:"normal"}}>{eventDateLabel(nextEvent.starts_at,today)}<br/><span>{nextEvent.all_day?"Hela dagen":formatEventTime(nextEvent.starts_at)}</span></div><div><strong>{nextEvent.title}</strong><p>{nextEvent.target_member_id===member?.id?"För dig":nextEvent.responsible_member_id===member?.id?"Ditt ansvar":nextEventTarget?.display_name??"Familjen"}{nextEvent.location?` · ${nextEvent.location}`:""}</p></div><span className="tag green">Kalender</span></div>:<p className="muted">Inga kommande aktiviteter hittades.</p>}</section></HomeSection>
<HomeSection id="lists">{member && <HomeLists familyId={member.family_id} />}</HomeSection>
<HomeSection id="savings">{member?.role==="barn"&&<section className="card" style={{marginTop:18}}><div className="card-heading"><h3>🐷 Mina pengar</h3><Link href="/sparande">Min sparplan</Link></div><p className="muted">Planera din vecko- eller månadspeng och se hur ditt sparande kan växa.</p></section>}</HomeSection>

<HomeSection id="wishlists"><section className="card" style={{marginTop:18}}><div className="card-heading"><h3>🎁 Önskelistor</h3><Link href="/onskelistor">Öppna önskelistor →</Link></div><p className="muted">{member?.role==="barn"?"Vad önskar du dig? Lägg till dina önskningar här.":"Familjens önskningar, samlade på ett ställe."}</p></section></HomeSection>

{homeError&&<p role="alert" className="family-admin-error" style={{marginTop:16}}>{homeError}</p>}<HomeSection id="tasks"><section className="card tasks"><div className="card-heading"><h3>{member?.role==="barn"?"Mina uppgifter":"Uppgifter"}</h3><Link href="/uppgifter">Visa alla</Link></div>{member?.role!=="barn"&&<p className="muted">Senaste uppgifterna i familjen</p>}{tasks.slice(0,2).map(t=><div className="task-row" key={t.id}><span className="check">{t.completed_at?"✓":""}</span><div><strong style={{textDecoration:t.completed_at?"line-through":"none"}}>{t.title}</strong><p>{t.scheduled_date?"Idag · ":""}{members.find(m=>m.id===t.assigned_member_id)?.display_name??"Familjen"} · +{t.xp} XP</p></div>{member?.role==="barn"&&!t.completed_at&&<button type="button" className="primary" style={{marginLeft:"auto",padding:"7px 12px"}} disabled={completingTaskId!==null} onClick={()=>void completeMyTask(t)}>{completingTaskId===t.id?"Sparar...":"Markera klar"}</button>}{t.completed_at&&t.scheduled_date?<span role="img" aria-label="Klar" style={{marginLeft:"auto",color:"#237544",fontSize:28,fontWeight:800}}>✓</span>:member?.role==="barn"&&t.completed_at&&<span className="tag green" style={{marginLeft:"auto"}}>Klar</span>}{member?.role!=="barn"&&!t.scheduled_date&&<button type="button" className="secondary" style={{marginLeft:"auto",padding:"6px 9px"}} disabled={removingTaskId!==null} onClick={()=>void removeTask(t)} aria-label={`Ta bort uppgiften ${t.title}`}>{removingTaskId===t.id?"Tar bort...":"Ta bort"}</button>}</div>)}{!tasks.length&&<p className="muted">{member?.role==="barn"?"Du har inga tilldelade uppgifter just nu.":"Inga uppgifter ännu."}</p>}</section></HomeSection></HomePreferences></section></main>}
