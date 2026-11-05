"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InvitationPage(){
 const supabase=useMemo(()=>createClient(),[]);const router=useRouter();
 const [token,setToken]=useState("");const [email,setEmail]=useState<string|null>(null);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const lock=useRef(false);
 useEffect(()=>{let active=true;const code=new URLSearchParams(window.location.search).get("kod")??"";if(!/^[a-f0-9]{64}$/.test(code)){setError("Inbjudningslänken är ogiltig. Be Admin om en ny länk.");setLoading(false);return}setToken(code);void supabase.auth.getUser().then(({data})=>{if(active)setEmail(data.user?.email??null)}).catch(()=>{if(active)setError("Kunde inte kontrollera inloggningen. Ladda om och försök igen.")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[supabase]);
 async function accept(){if(lock.current||!email||!token)return;lock.current=true;setBusy(true);setError("");try{const result=await supabase.rpc("accept_family_invitation",{p_token:token});if(result.error)throw result.error;router.replace("/");router.refresh()}catch(error){setError(typeof error==="object"&&error&&"message" in error?String(error.message):"Kunde inte acceptera inbjudningen.")}finally{lock.current=false;setBusy(false)}}
 const login=`/login?next=${encodeURIComponent(`/inbjudan?kod=${token}`)}`;
 return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">VARDILO</p><h1>Välkommen till familjen</h1><p className="muted">Logga in med den e-postadress som Admin har bjudit in. När du accepterar kopplas ditt konto till familjeprofilen och rollen som Admin har valt.</p>{loading?<p role="status">Kontrollerar inloggning…</p>:token&&<>{email?<><p>Inloggad som <strong>{email}</strong></p><button className="primary" disabled={busy} onClick={()=>void accept()}>{busy?"Kopplar kontot…":"Acceptera inbjudningen"}</button><button className="auth-switch" disabled={busy} onClick={()=>{void supabase.auth.signOut().then(({error})=>{if(error){setError("Kunde inte logga ut. Försök igen.");return}router.replace(login)})}}>Använd ett annat konto</button></>:<Link className="primary" href={login}>Logga in eller skapa konto</Link>}</>}{error&&<p role="alert">{error}</p>}</section></main>;
}
