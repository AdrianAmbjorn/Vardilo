# Vardilo – licensinventering 2026-11-06

Status: teknisk inventering utförd; inte ett juridiskt godkännande av samtliga distributionsvillkor.

## Låsta direkta beroenden

| Paket | Version | Licens enligt installerat paket |
|---|---|---|
| next | 16.4.5 | MIT |
| react, react-dom | 19.3.1 | MIT |
| @supabase/supabase-js | 2.119.0 | MIT |
| @supabase/ssr | 0.12.7 | MIT |
| ical.js | 2.2.1 | MPL-2.0 |
| typescript | 7.0.2 | Apache-2.0 |
| @types/node | 26.6.6 | MIT |
| @types/react, @types/react-dom | 19.3.0 | MIT |

`heic-to` är borttaget ur package.json, låsfil och klientkod. Ingen ersättande HEIC-konverterare har lagts till. Webbläsarens egna bildavkodning används; utan inbyggt HEIC-stöd visas instruktion att exportera som JPEG. Äldre immutable Vercel-deployments kan fortfarande innehålla biblioteket. Avlägsnandet innebär inte ett retroaktivt juridiskt godkännande av tidigare distributioner; behåll dessa versionsuppgifter för granskning och återställning.

## Inventering och notiser

- `dependency-licenses.json` innehåller npm-låsfilens paket, plattformsberoende paket, installerade Next.js-bundlar och separat npm-upplösning av Edge-beroenden.
- `public/third-party-notices.txt` innehåller de licens- och NOTICE-filer som faktiskt följde med installationen, inklusive utvecklingsverktyg och serverkomponenter.
- Generera om med `node scripts/license-inventory.mjs` efter `npm ci` och separat installation i `docs/edge-dependencies`.
- Vissa av Next.js interna vendorpaket saknar fristående LICENSE-fil eller versionsuppgift. De är markerade i inventeringen och måste bedömas mot den levererade Next.js-källan; rapporten döljer inte dessa luckor.

## Copyleft som finns kvar

`ical.js` är oförändrat MPL-2.0-material som används vid kalenderimport i webbläsaren. Källan görs tillgänglig via `/vendor/ical.js-2.2.1/source-index.txt`, med ursprunglig LICENSE och package.json. Appens övriga kod ges inte automatiskt MPL-licens. Se Mozilla: https://www.mozilla.org/en-US/MPL/2.0/FAQ/

Next.js har kvar server-/byggberoenden på `sharp`/`libvips`, inklusive LGPL-licensierade bibliotek och en valfri WASM-variant med sammansatta licenser. Dessa är inte den borttagna HEIC-konverteraren och ska inte beskrivas som att all LGPL är borta. Nexts ikonrenderare `@vercel/og` är MPL-2.0 och innehåller ytterligare tredjepartsmaterial. Serverdrift och leverans av klient-JavaScript är olika distributionsfall; eventuell vidareleverans av serverbinärer kräver ny bedömning. Licensinformationen från libvips-paketets README ingår i notiserna.

## Edge Functions

`manage-child-login` importerar @supabase/supabase-js 2.119.0. `calendar-push` importerar 2.106.2 och web-push 3.6.7 (MPL-2.0), med @types/web-push 3.6.4 som typberoende. Direktversionerna är fixerade.

`docs/edge-dependencies/package-lock.json` är en separat npm-inventering/sårbarhetssnapshot. Den ska **inte** förväxlas med en Deno-låsfil som används i Supabases bundling. Lokal framtagning av en komplett Deno-låsfil kunde inte verifieras eftersom Deno nekades anslutning till npm-registret i arbetsmiljön. Ingen fabricerad låsfil har lagts in. En kontrollerad Deno-resolvermiljö och serverns bundlingsstöd behöver verifieras innan transienta Edge-beroenden kan kallas fullt reproducerbara.

## Övriga tillgångar

Appens husikon skapas i kod. Ingen extern bildbank, webbfontimport eller annonserings-SDK identifierades i granskad appkod. Profilbilder är användarinnehåll. Rättigheter till namn, varumärke, tidigare bidrag och överföring till ett framtida bolag behöver dokumenteras separat. Inventeringen är inte ett besked om varumärkesskydd eller slutlig licensförenlighet.
