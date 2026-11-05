# Vardilo – tredjepartslicenser (pågående inventering)

Senast kontrollerad: 2026-11-05. Denna fil är en intern inventering, **inte** en fullständig eller juridiskt godkänd licensförteckning.

| Direkt beroende | Angiven version i package.json | Licens / status | Källa |
| --- | --- | --- | --- |
| next | latest | MIT; exakt installerad version behöver låsas | https://github.com/vercel/next.js/blob/canary/license.md |
| react | latest | MIT | https://github.com/facebook/react/blob/main/LICENSE |
| react-dom | latest | MIT | https://github.com/facebook/react/blob/main/LICENSE |
| @supabase/supabase-js | latest | MIT | https://github.com/supabase/supabase-js/blob/master/LICENSE |
| @supabase/ssr | latest | MIT; kontrollera exakt version | https://github.com/supabase/ssr |
| ical.js | 2.2.1 | MPL-2.0; kontrollera tillämpliga filbaserade skyldigheter | https://github.com/kewisch/ical.js |
| heic-to | 1.6.7 | **LGPL-3.0**; kräver särskild granskning av webbundling, tillgänglig källkod, notiser och möjlighet att ersätta LGPL-komponenten | https://www.npmjs.com/package/heic-to |
| @types/node, @types/react, @types/react-dom, typescript | latest | Utvecklingsberoenden; verifiera låsta versioner och licenser | respektive npm-paket |

## Måste göras innan extern kommersiell distribution

1. Generera och checka in reproducerbar låsfil och lås direkta beroenden; gör ändringen på separat gren och verifiera byggning innan merge.
2. Inventera **hela installerade beroendeträdet** inklusive transitive dependencies, WASM/binärfiler och tillhörande licenstexter. Skapa komplett NOTICES-fil.
3. Granska hur `heic-to` (och inbäddade libheif/libde265) levereras till webbläsaren mot LGPL-3.0. Överväg ett annat bibliotek eller separat utbytbar distribution efter teknisk/juridisk bedömning.
4. Kontrollera MPL-2.0-villkor för `ical.js`, särskilt om bibliotekets filer modifieras och distribueras.
5. Inventera externa bilder, logotyper, ikoner, typsnitt, användargenererat material och tredjeparts-API:er separat.
6. Kontrollera även Supabase Edge Functions och deras npm-/WASM-beroenden.

Vardilos egen källkod är inte automatiskt öppen källkod bara för att den använder open-source-paket. Avsaknad av en LICENSE-fil innebär inte att tredje parts licenser upphör att gälla.
