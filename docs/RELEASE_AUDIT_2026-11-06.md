# Vardilo: releasegranskning 2026-11-06

Status: tekniska rättningar publicerade för fortsatt familjetest. Inte slutligt juridiskt godkänd eller färdigverifierad för bred lansering.

## Genomfört

- Galleri-routen ger 404, nya uppladdningar stängda; tidigare bilder och användardata bevarade.
- heic-to borttaget; native HEIC-visning när webbläsaren stödjer det, annars tydligt JPEG-alternativ.
- Exakta appberoenden, npm-låsfil, npm ci, 81 tester, produktionsbygge och typkontroll passerar. Root och Edge-npm-inventering: 0 kända sårbarheter vid kontrollen.
- 271 licensposter inventerade, tillgängliga notices och oförändrad ical.js-källkod publicerade. Server-LGPL/MPL, vendorpaketens metadata och äldre HEIC-deployments behöver fortsatt verifiering.
- Valfri födelsedag utan nytt födelseår; befintliga datum bevarade. Vårdnadshavares egen försäkran sparas för nya barnlogins, utan att beskrivas som verifierad vårdnad.
- RLS/Storage/Edge-åtkomst granskad och privilegier för triggerfunktioner/anon begränsade.
- Faktiskt fel i veckomenyns created_by rättat utan att skriva om tidigare menyer.
- Integritetspolicy, testvillkor och barninformation publicerade som tydligt märkta utkast.
- Fyra SQL-sviter med rollback, separat barnrollstest, 15 verkliga API-flöden och extra profilbildstest passerar. Se security/TEST_MATRIX.md för exakt omfattning.

## Återstår före bred lansering

1. Ansvarigs fullständiga juridiska namn och publicerbar kontaktmejl, rättsliga grunder, avtal/överföringar, barn-/platsbedömning och professionell juridik-/licensverifiering. Inga bindande avtal har accepterats.
2. Fungerande fullständig kontoexport/radering och beslutad gallring. Inga befintliga data ska tas bort utan kontrollerad rutin.
3. Full databas- och separat Storage-backup samt provad återställning. Schema-checkpoint och versionsrollback finns, men är ingen full databackup.
4. Verklig inkorgsleverans, bekräftelselänk mellan enheter, fysisk iOS/Android-push, HEIC i Safari samt full inloggad mobil-/datorgenomgång. Publika formulär har inspekterats på dator.
5. Supabase Auth-skydd mot läckta lösenord, globalt serverkrav på lösenord samt redirect-/SMTP-konfiguration behöver slutverifieras. Kvarvarande advisor-varningar ska bedömas, inte stängas av blint.
6. Full reproducerbar Deno-låsfil för Edge Functions; npm-snapshoten är endast inventering och konsumeras inte av Supabases bundler.
7. Kontrollerad städning av en syntetisk audit-familj med tre testkonton: verktygsbekräftelsen gick ut innan transaktionen kördes. Inga befintliga användardata har raderats.

Ingen betalning, planuppgradering eller automatisk övergång till betalabonnemang har införts.
