# Finslipning av vardagsflöden 2026-11-06

Omfattning: befintliga funktioner på startsidan, i kalendern, listorna och chatten. Inga databasändringar eller nya produktfunktioner.

- Startsidan: fel vid uppgiftsmarkering/radering eller utloggning frigör knapparna igen. Nätverksfel vid Auth-kontroll behandlas inte längre som saknad inloggning. Utloggning avser den aktuella sessionen.
- Kalender: alla läsbara aktiviteter hämtas i stabilt sorterade sidor om 500, även över 1000 poster. En felande sida lämnar tidigare kalenderdata kvar. Spara aktivitet/lov/studiedag, svara på tilldelning och radera lov återhämtar sig efter kastade nätverksfel utan låsta knappar eller tömt formulär.
- Listor: osparad punkttext återställs per lista när användaren växlar under samma sidbesök. Detta är minne i den öppna sidan, inte lagring som överlever omladdning. Ny lista börjar med ett tomt punktfält och borttagna listors utkast rensas.
- Chatt: fel vid kontroll av konto/familj hanteras som anslutningsfel. Fel i meddelandehämtningen är separata från skickfel och försvinner efter lyckad hämtning; skickfel döljs inte av en bakgrundsuppdatering.

Verifiering: 96 automatiska tester passerar, inklusive 8 nya regressionstester för sidindelning, partiellt laddningsfel, knappåterställning, listutkast och chattåteranslutning. TypeScript-kontroll och produktionsbyggning passerar. Inga befintliga användardata ändrades under dessa tester.

Begränsningar: mockade nätverksfel och kodtester ersätter inte full visuell kontroll i inloggat läge, mobil/touch, riktiga pushleveranser, inkorgsleverans eller importgranskning över alla tidszoner. Den tidigare releasegranskningens juridik-, backup- och leverantörspunkter kvarstår.
