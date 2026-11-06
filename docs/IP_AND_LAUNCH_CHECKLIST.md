# Vardilo – rättigheter och lanseringskontroll

Status: **ÖPPEN – inte godkänd för offentlig lansering**. Upprättad 2026-11-05.

## Rättigheter

- [ ] Dokumentera vem som skapat och har rättigheter till appens kod, design, namn, logotyp och innehåll. AI-genererad kod kan ha särskilda upphovsrättsliga begränsningar.
- [ ] Inventera alla externa bidrag och säkerställ skriftliga överlåtelser/licenser vid behov.
- [ ] Kontrollera namn och varumärke Vardilo hos PRV/EUIPO samt relevanta domäner. Inget registrerat skydd antas här.
- [ ] Vid bildande av Vardilo AB: låt jurist/redovisningskonsult bedöma och dokumentera överföring av relevanta rättigheter från privatperson till bolaget, inklusive eventuell skatteeffekt.
- [ ] Säkerställ att domän, GitHub-repository, Vercel, Supabase, betalningskonton och avtal kan hanteras av bolaget och överlåtas vid försäljning.

## Licenser och teknik

- [ ] Slutför docs/THIRD_PARTY_LICENSES.md, inklusive LGPL-3.0 (`heic-to`) och MPL-2.0 (`ical.js`).
- [x] Webappens direkta beroenden är exakta och package-lock.json verifierad med ren npm ci och byggning. Separat Edge-inventering finns; full Deno-låsning återstår.
- [ ] Granska licenser för bilder, ikoner och typsnitt; förvara bevis på tillstånd.
- [ ] Dokumentera databas, driftsättning, säkerhetskopior, återställning och incidentrutiner.

## GDPR, barn och familjer

- [ ] Fastställ personuppgiftsansvarig och biträden samt kontrollera avtal med driftleverantörer.
- [ ] Kartlägg ändamål, laglig grund, datakategorier, lagringstider, underbiträden och eventuella tredjelandsöverföringar.
- [ ] Publicera korrekta integritetsvillkor och användarvillkor innan externa testfamiljer registreras.
- [ ] Utforma rutiner för registerutdrag, rättelse, radering, export, incidentrapportering och kontaktväg.
- [ ] Bedöm särskilda risker för barns personuppgifter och eventuellt behov av konsekvensbedömning (DPIA).
- [ ] Slutför end-to-end-verifiering på riktiga telefoner; kod-, API- och databastester finns i docs/security/TEST_MATRIX.md.
- [x] Ny registrering samlar frivilligt dag/månad, inte födelseår. Historiska uppgifter har bevarats enligt instruktionen att inte radera användardata.

## Betalningar

- [ ] Bestäm gratis/Premium-funktioner, pris, momsmodell, ångerrätt, uppsägning och hur abonnemang godkänns aktivt.
- [ ] Ingen automatisk betalning efter gratis beta utan uttryckligt köpbeslut.

Denna checklista är arbetsdokumentation och ersätter inte juridisk rådgivning eller en säkerhetsrevision.

Se även docs/legal/RELEASE_DECISIONS.md för de konkreta juridiska beslut som återstår.
