"use client";
import { signOutOnThisDevice } from "@/lib/device-signout";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { invitationAccount } from "@/lib/invitation-account";
import "../login/login.css";
import { createClient } from "@/lib/supabase/client";

export default function InvitationPage(){
 const supabase=useMemo(()=>createClient(),[]);const router=useRouter();
 const [token,setToken]=useState("");const [email,setEmail]=useState<string|null>(null);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const lock=useRef(false);const [attempt,setAttempt]=useState(0);const [sessionError,setSessionError]=useState(false);
 useEffect(()=>{let active=true;const code=new URLSearchParams(window.location.search).get("kod")??"";setLoading(true);setSessionError(false);setError("");if(!/^[a-f0-9]{64}$/.test(code)){setError("Inbjudningslänken är ogiltig. Be familjens administratör om en ny länk.");setLoading(false);return}setToken(code);void invitationAccount(supabase.auth).then(address=>{if(active)setEmail(address)}).catch(()=>{if(active){setSessionError(true);setError("Kunde inte kontrollera inloggningen. Kontrollera din anslutning och försök igen.")}}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[supabase,attempt]);
 async function switchAccount(){if(lock.current)return;lock.current=true;setBusy(true);setError("");try{const {error}=await signOutOnThisDevice(supabase);if(error)throw error;router.replace(login)}catch{setSessionError(true);setError("Kunde inte slutföra utloggningen. Kontrollera anslutningen och försök igen.")}finally{lock.current=false;setBusy(false)}}

 async function accept(){if(lock.current||!email||!token)return;lock.current=true;setBusy(true);setError("");try{const result=await supabase.rpc("accept_family_invitation",{p_token:token});if(result.error)throw result.error;router.replace("/");router.refresh()}catch(error){setError(typeof error==="object"&&error&&"message" in error?String(error.message):"Kunde inte acceptera inbjudningen.")}finally{lock.current=false;setBusy(false)}}
 const login=`/login?next=${encodeURIComponent(`/inbjudan?kod=${token}`)}`;
 return <main className="auth-shell login-page"><section className="auth-card login-card invitation-card"><p className="eyebrow">VARDILO</p><h1>Välkommen till familjen</h1><p className="muted">Logga in med den e-postadress som familjens administratör har bjudit in. När du accepterar kopplas ditt konto till familjeprofilen och rollen som administratören har valt.</p>{loading?<p role="status">Kontrollerar inloggning…</p>:sessionError?<button type="button" className="secondary" onClick={()=>setAttempt(value=>value+1)}>Försök igen</button>:token&&<>{email?<><p>Inloggad som <strong>{email}</strong></p><button className="primary" disabled={busy} onClick={()=>void accept()}>{busy?"Kopplar kontot…":"Acceptera inbjudningen"}</button><button className="secondary" disabled={busy} onClick={()=>void switchAccount()}>Använd ett annat konto</button></>:<Link className="primary" href={login}>Logga in eller skapa konto</Link>}</>}{error&&<p role="alert">{error}</p>}</section></main>;
}
