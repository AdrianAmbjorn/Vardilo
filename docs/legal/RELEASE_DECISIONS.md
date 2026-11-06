# Juridiska beslut före extern lansering

Status 2026-11-06: dokumentförslag och tekniska skydd finns, men ingen slutlig juridisk klarering.

Användaren har valt privatperson under testperioden. Fullständigt juridiskt namn och en kontaktmejl som får publiceras saknas fortfarande. `LEGAL_CONTROLLER_NAME` och `LEGAL_CONTACT_EMAIL` kan konfigureras när de uppgifterna är bekräftade. Vi anger inte ett ännu obildat Vardilo AB som avtalspart.

## Kräver ansvarigs beslut eller extern verifiering

1. Fastställ identitet och offentlig kontaktväg, rättslig grund för varje behandling, särskilt barns delade innehåll, födelsedagar och platsfunktioner. En teknisk roll i appen är inte verifierad vårdnad.
2. Bedöm om behandlingen av barn och platsdata kräver en konsekvensbedömning (DPIA). Dokumentera intresseavvägningar där de används. Genomför rimliga vårdnads-/ålderskontroller utan att samla in fler uppgifter än nödvändigt.
3. Granska och vid behov ingå personuppgiftsbiträdesavtal med Supabase, Vercel och Resend. Inga avtal har accepterats i denna granskning. Kontrollera underbiträden och överföringar: Supabase-projektet ligger i eu-west-1, men Vercels serverfunktioner har observerats i iad1, och drift-/supportbehandling kan ske i andra länder.
4. Besluta och inför gallring av inaktiva konton, loggar, pushprenumerationer och gamla bilder. Det finns ännu ingen verifierad generell automatisk gallring. Födelseår som redan fanns och tidigare galleribilder har inte raderats.
5. Ordna en praktiskt fungerande, identitetskontrollerad rutin för registerutdrag/export, rättelse, radering och barnets egna rättigheter. Självbetjäning för full kontoradering/export är inte färdig.
6. Fastställ incidentansvar, rapporteringsrutin och faktisk backup/återställning med separat lagring. En schema-checkpoint är inte en full databas- eller filbackup.
7. Granska immateriella rättigheter och tredjepartslicenser, inklusive historiska heic-to-deployments, återstående server-LGPL/MPL och vendorpaketens ofullständiga licensmetadata. Ingen varumärkessökning eller professionell licensbedömning har gjorts.
8. Gratis testperiod övergår inte automatiskt i köp. Framtida betalning, inklusive pris/moms, ångerrätt och uppsägning, behöver ett separat aktivt köpbeslut och juridiskt granskat flöde.

## Underlag

- IMY, information i integritetspolicy: https://www.imy.se/vanliga-fragor-och-svar/vad-ska-en-integritetspolicy-innehalla/
- IMY, barns personuppgifter: https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/introduktion-till-gdpr/personuppgifter/personuppgifter-om-barn/
- IMY, rättslig grund: https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/rattslig-grund/
- För onlinetjänster med samtycke som grund krävs i Sverige vårdnadshavarens samtycke under 13 år; andra länder kan ha en högre gräns. Detta är inte samma sak som att alla barnbehandlingar automatiskt ska bygga på samtycke.
- För utkastens faktauppgifter har koden och driftsinställningar där åtkomst finns granskats. Grunder, avtal och lagringstider som inte kunnat verifieras markeras som öppna.
