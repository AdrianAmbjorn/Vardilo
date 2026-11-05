"use client";
import { useLanguage } from "./language-provider";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useMemo,useRef,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {navigationForRole} from "@/lib/app-navigation";
import "./app-navigation.css";
export default function AppNavigation(){
 const { t, language, locale } = useLanguage();

 const pathname=usePathname();const supabase=useMemo(()=>createClient(),[]);const [role,setRole]=useState<string|null>(null);const [revision,setRevision]=useState(0);const details=useRef<HTMLDetailsElement>(null);const epoch=useRef(0);
 const hidden=pathname==="/"||(pathname.startsWith('/login')||pathname==='/losenord')||pathname.startsWith('/auth/')||pathname==='/inbjudan';
 useEffect(()=>{details.current?.removeAttribute('open')},[pathname]);
 useEffect(()=>{const {data}=supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){epoch.current++;setRole(null);details.current?.removeAttribute('open')}else if(event==='SIGNED_IN'||event==='USER_UPDATED'){epoch.current++;setRole(null);setRevision(value=>value+1)}});return()=>data.subscription.unsubscribe()},[supabase]);
 useEffect(()=>{let active=true;const request=epoch.current;setRole(null);if(hidden)return;void(async()=>{try{const {data}=await supabase.auth.getUser();if(!data.user)return;const me=await supabase.from('family_members').select('role').eq('user_id',data.user.id).maybeSingle();if(active&&request===epoch.current&&!me.error)setRole(me.data?.role??null)}catch{/* Keep navigation hidden until a family identity is confirmed. */}})();return()=>{active=false}},[hidden,pathname,revision,supabase]);
 if(hidden||!role)return null;
 return <div className="app-navigation"><details ref={details} onKeyDown={event=>{if(event.key==='Escape'){details.current?.removeAttribute('open');details.current?.querySelector('summary')?.focus()}}}><summary><span className="app-menu-house" aria-hidden="true"><svg viewBox="0 0 24 24" width="21" height="21"><path d="M3.5 10.7 12 3.8l8.5 6.9v8.1a1.2 1.2 0 0 1-1.2 1.2H4.7a1.2 1.2 0 0 1-1.2-1.2v-8.1Z" fill="currentColor"/><path d="M9.1 20v-5.2h5.8V20" fill="white"/></svg></span><span>{t("Meny")}</span><span aria-hidden="true" className="app-menu-chevron">⌄</span></summary><nav aria-label={t("Appmeny")}>{navigationForRole(role).map(([title,description,href])=><Link href={href} key={href} aria-current={pathname===href?'page':undefined} onClick={()=>details.current?.removeAttribute('open')}><strong>{t(title)}</strong><small>{t(description)}</small></Link>)}<Link href="/profil" onClick={()=>details.current?.removeAttribute("open")} aria-current={pathname==='/profil'?'page':undefined}><strong>{t("Min profil")}</strong><small>{t("Bild och inställningar")}</small></Link>{['admin','förälder'].includes(role)&&<Link href="/familj/admin" onClick={()=>details.current?.removeAttribute("open")}><strong>{t("Familjen")}</strong><small>{t("Medlemmar och konton")}</small></Link>}</nav></details></div>;
}
