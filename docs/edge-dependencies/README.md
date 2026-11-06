# Separat Edge-inventering

Denna package.json/package-lock.json används endast för att inventera och sårbarhetskontrollera npm-träden för de fixerade importversionerna i de två Edge Functions. Kör `npm ci --ignore-scripts --prefix docs/edge-dependencies` och `npm audit --prefix docs/edge-dependencies`.

Det är inte Edge Functions produktionsbyggsystem, och npm-låsfilen konsumeras inte automatiskt av Deno/Supabase. En full Deno-låsfil kunde inte genereras och verifieras i denna arbetsmiljö: Deno fick connection refused mot registry.npmjs.org, medan npm-installationerna fungerade. Vi har därför bevarat den fungerande Edge-konfigurationen och inte levererat en fabricerad låsfil. Direktimporterna är fortfarande exakta versioner; en full transitive lock-verifiering återstår i leverantörens resolvermiljö.
