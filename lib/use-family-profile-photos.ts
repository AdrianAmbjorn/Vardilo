"use client";
import { useEffect, useState } from "react";
import type { createClient } from "@/lib/supabase/client";

export function useFamilyProfilePhotos(supabase: ReturnType<typeof createClient>, familyId: string | undefined) {
  const [profilePhotos, setProfilePhotos] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!familyId) return;
    let active = true;
    const urls: string[] = [];
    const bucket = supabase.storage.from("family-profile-photos");
    setProfilePhotos({});
    async function loadPhotos() {
      const { data } = await bucket.list(familyId, { limit: 100 });
      if (!active || !data) return;
      const photos = await Promise.all(data.filter(photo => photo.name.endsWith(".jpg")).map(async photo => {
        const { data } = await bucket.download(`${familyId}/${photo.name}`);
        if (!active || !data) return null;
        const url = URL.createObjectURL(data);
        urls.push(url);
        return [photo.name.slice(0, -4), url] as const;
      }));
      if (active) setProfilePhotos(Object.fromEntries(photos.filter(photo => photo !== null)));
    }
    void loadPhotos().catch(() => { /* Keep the initials if storage is unavailable. */ });
    return () => {
      active = false;
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [familyId, supabase]);
  return profilePhotos;
}
