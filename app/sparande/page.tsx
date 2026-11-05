"use client";
import Link from "next/link";
import {useEffect,useMemo,useRef,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {kronor} from "@/lib/budget";
import {savingsAmount,savingsProjection,type AllowancePeriod} from "@/lib/savings";
import "./savings.css";
export default function SavingsPage(){
 const supabase=useMemo(()=>createClient(),[]);const [memberId,setMemberId]=useState<string|null>(null);const [name,setName]=useState("");const [period,setPeriod]=useState<AllowancePeriod>("week");const [allowance,setAllowance]=useState("");const [saving,setSaving]=useState("");const [loading,setLoading]=useState(true);const [failed,setFailed]=useState(false);const [denied,setDenied]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [retry,setRetry]=useState(0);const lock=useRef(false);const epoch=useRef(0);const authUser=useRef<string|null>(null);
 useEffect(()=>{const {data}=supabase.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"||(event==="SIGNED_IN"&&session?.user.id!==authUser.current)){epoch.current++;authUser.current=session?.user.id??null;setMemberId(null);setAllowance("");setSaving("");setName("");setDenied(!session);setRetry(value=>value+1)}});return()=>data.subscription.unsubscribe()},[supabase]);
 useEffect(()=>{let active=true;const request=epoch.current;setLoading(true);setFailed(false);setMessage("");
 void(async()=>{try{
 const {data:auth}=await supabase.auth.getUser();if(!auth.user)throw Error('Logga in först.');if(request!==epoch.current)return;authUser.current=auth.user.id;const me=await supabase.from('family_members').select('id,display_name,role').eq('user_id',auth.user.id).maybeSingle();if(me.error||!me.data)throw Error('Kunde inte hitta din profil.');
 if(me.data.role!=="barn"){if(active)setDenied(true);return}
 const result=await supabase.from('member_savings_plans').select('period,allowance_cents,saving_cents').eq('member_id',me.data.id).maybeSingle();if(result.error)throw result.error;
 if(active&&epoch.current===request){setMemberId(me.data.id);setName(me.data.display_name);setDenied(false);setPeriod(result.data?.period??'week');setAllowance(result.data?String(result.data.allowance_cents/100).replace('.',','):'');setSaving(result.data?String(result.data.saving_cents/100).replace('.',','):'')}
 }catch{if(active){setFailed(true);setMessage('Din sparplan kunde inte hämtas. Försök igen.')}}finally{if(active)setLoading(false)}})();return()=>{active=false};
 },[supabase,retry]);
 const amount=savingsAmount(allowance);const saved=savingsAmount(saving);const valid=amount!==null&&saved!==null&&saved<=amount;const projection=savingsProjection(amount??0,saved??0,period);const periodWord=period==='week'?'vecka':'månad';
 async function save(event:React.FormEvent){event.preventDefault();if(!memberId||lock.current||failed||!valid)return;const request=epoch.current;lock.current=true;setBusy(true);setMessage("");try{const {error}=await supabase.from('member_savings_plans').upsert({member_id:memberId,period,allowance_cents:amount,saving_cents:saved},{onConflict:'member_id'});if(error)throw error;if(request===epoch.current)setMessage('Din sparplan är sparad!')}catch{if(request===epoch.current)setMessage('Det gick inte att spara. Dina val finns kvar – försök igen.')}finally{lock.current=false;setBusy(false)}}
 return <main className="section-shell savings-page"><header className="section-header"><div><p className="eyebrow">SMÅ STEG, STORA DRÖMMAR</p><h1>Mina pengar</h1><p className="muted">Lite att använda nu. Lite till något du längtar efter.</p></div><Link href="/" className="secondary">Hem</Link></header>
 <div className="savings-content">{loading?<p role="status">Hämtar din sparplan…</p>:denied?<section className="card"><h2>Barnens sparplan</h2><p>Här kan barnet planera sin vecko- eller månadspeng med sitt eget konto.</p><Link href="/budget" className="secondary">Till föräldrarnas budget</Link></section>:<>
 {message&&<p role="status" className={failed?'savings-error':'savings-message'}>{message}{failed&&<button className="secondary" onClick={()=>setRetry(value=>value+1)}>Försök igen</button>}</p>}
 {!failed&&<><section className="card savings-plan"><div className="savings-plan-heading"><span aria-hidden="true">🐷</span><div><h2>{name?`Hej, ${name}!`:'Din sparplan'}</h2><p>Du väljer hur du vill planera dina pengar.</p></div></div><form onSubmit={save}>
 <div className="savings-period" role="group" aria-label="Veckopeng eller månadspeng"><button type="button" disabled={busy} aria-pressed={period==='week'} onClick={()=>{setPeriod('week');setMessage('')}}>Veckopeng</button><button type="button" disabled={busy} aria-pressed={period==='month'} onClick={()=>{setPeriod('month');setMessage('')}}>Månadspeng</button></div>
 <div className="savings-fields"><label>Jag får varje {periodWord}<div><input value={allowance} inputMode="decimal" required disabled={busy} placeholder="Till exempel 100" onChange={event=>{setAllowance(event.target.value);setMessage('')}}/><span>kr</span></div></label><label>Jag vill spara varje {periodWord}<div><input value={saving} inputMode="decimal" required disabled={busy} placeholder="Till exempel 20" onChange={event=>{setSaving(event.target.value);setMessage('')}}/><span>kr</span></div></label></div>
 {amount!==null&&saved!==null&&saved>amount&&<p role="alert" className="savings-error">Välj ett sparbelopp som är högst lika stort som din {period==='week'?'veckopeng':'månadspeng'}.</p>}
 {valid&&<div className="savings-split"><div><span>Att spara</span><strong>{kronor(saved)}</strong></div><div><span>Kvar att använda</span><strong>{kronor(projection.keep)}</strong></div></div>}
 <button className="primary" disabled={busy||!valid}>{busy?'Sparar…':'Spara min plan'}</button></form></section>
 <section className="savings-year"><span aria-hidden="true">🌱</span><p>Om du sparar {valid?kronor(saved):'ett litet belopp'} varje {periodWord}</p><strong>{valid?kronor(projection.year):'Vad vill du spara till?'}</strong><p>{valid?'så mycket blir det på ett år.':'Fyll i din plan så räknar vi tillsammans.'}</p><small>Vi räknar på {period==='week'?'52 veckor':'12 månader'}. Det här visar vad du kan spara framöver.</small></section>
 <section className="card savings-examples"><h2>Små summor växer</h2><div><article><span>20 kr i {periodWord==='vecka'?'veckan':'månaden'}</span><strong>{kronor(projection.example20)}</strong><small>på ett år</small></article><article><span>100 kr i {periodWord==='vecka'?'veckan':'månaden'}</span><strong>{kronor(projection.example100)}</strong><small>på ett år</small></article></div></section></>}
 </>}
 </div></main>;
}
