# Verifieringsmatris 2026-11-06

Resultaten avser källkod och Supabase-projektet jnthaerbttgxnphkolvj. Använd inte ordet slutligt godkänd om juridik, full säkerhetsrevision eller tester på verkliga telefoner.

## Automatiska kodtester

81 tester passerar, inklusive: autentiseringsfel och bekräftelselänkar, återställning av lösenord, inbjudningar, barninloggning/identitet, guardian-krav, RLS-relaterade klientflöden, önskelistors reservationer och radering, dagliga uppgifter och XP, budget/private budget/sparande, språk-/startsidesval, kalenderns nästa återkommande händelse, bildinläsning utan HEIC-konverterare samt exakta paketversioner/låsfil.

`npm ci` (även normal installation med installationsskript), produktionsbyggning och `npm run typecheck` har körts. Rootpaket och separat Edge-npm-upplösning rapporterade noll kända sårbarheter vid npm audit. Detta ersätter inte manuell kodgranskning eller ett penetrationstest.

## Databastester

- `daily-tasks.integration.sql`: PASS; flera barn, rätt svensk dag, förälders/annat barns spärrar, oföränderlig klarmarkering och XP en gång. Allt rullades tillbaka.
- `personal-budgets.integration.sql`: PASS; två vuxna, privata rader/arkiv, delad budget, månadslås och valfri betalare. Allt rullades tillbaka.
- `birthdays-gallery.integration.sql`: PASS; födelsedagsskydd, notifieringsdeduplicering/pushkö och skydd för galleriägare. Allt rullades tillbaka.
- `help_workflow.sql`: PASS; konkurrerande övertagande, rätt hjälpare, återöppning och notiser. Allt rullades tillbaka.
- Det större kombinationstestet för budget/önskelistor fick utgången verktygsbekräftelse vid omkörning. Det ersattes inte med ett påstående om PASS. Separat read-only-test av verklig barnroll passerade för reservationsrader, skyddad purchased-kolumn, maskerad wishlist-RPC samt föräldrabudget/arkiv. Nytt API-test kör dessa flöden i en isolerad testfamilj.

## Drift och konfiguration

Senaste publicerade version vid start: d5994fa, Vercel READY. Supabase ACTIVE_HEALTHY i eu-west-1. Samtliga public-tabeller har RLS. Två bildbucketar är privata. Tre schemalagda jobb är aktiva; 3 634 körningar i granskat dygn, inga rapporterade cron-fel. Att cron lyckas betyder inte i sig att en fysisk enhet visat en push.

Auth settings lästes genom det publika Auth-API:t: e-postregistrering på, e-postbekräftelse krävs (mailer_autoconfirm=false), anonym inloggning av. E-postleverans hela vägen till en verklig inkorg, spamklassning och länköppning mellan olika enheter har inte slutverifierats. Skyddet mot kända läckta lösenord är avstängt. Det globala serverkravet på lösenordslängd och leverantörens redirect-/SMTP-inställningar är inte färdiggranskade via tillgängliga API:er.

## Verkliga enheter och manuella begränsningar

Webbläsartest på dator respektive mobilbredd dokumenteras i slutrapporten. En smal/zoomad webbläsare är inte en fysisk iPhone eller Android. Touch, iOS-installation, bakgrundsleverans av push, HEIC på Safari och OS-behörighetsdialoger ska därför inte kallas sluttestade här.

## Isolerad API-familj

15 unika flöden PASS via verkliga Supabase Auth-, PostgREST-, Storage- och Edge-API:er: vuxeninloggning, familj/barnprofil, barnlogin med guardian-krav, föräldrainbjudan/acceptans, listor, maskerade reservationer, delad/privat budget och arkiv, riktad kalender, dagliga barnuppgifter, hjälpflöde, veckomeny, chatt/egna rader/notiser, check-in och privat barnspara, valfri födelsedag/språk/startsidesval samt nekad Galleri-uppladdning. Testfamiljen innehåller enbart syntetiska identiteter.

Veckomenyn avslöjade ett faktiskt FK-fel: två triggers skrev Auth-ID i created_by som refererar familjemedlems-ID. Migration 20261106102247 använder rätt familjemedlem, tar bort den dubbla triggern och bevarar befintliga menyer. API-testet passerade efter rättningen.
