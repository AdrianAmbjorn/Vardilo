# Automatisk uppdatering av familjechatten

Kontroll: family_chat_messages ingår i supabase_realtime. Ett faktiskt test med två isolerade audit-konton kunde prenumerera med Supabase Auth och ta emot en INSERT-händelse automatiskt i mottagarkontot. Testmeddelandet togs bort genom avsändarens API efteråt; ingen verklig familj kontaktades.

Klienträttning: prenumerationen behålls, men alla uppdateringstriggers går genom en kö som samlar flera samtidiga signaler till högst en pågående och en köad hämtning. Långsamma svar skrivs inte längre ständigt över av nya reservhämtningar. När chatten är synlig sker reservhämtning var tredje sekund i stället för var femtonde. Fokus, återanslutning och synlighetsbyte hämtar direkt. När sidan lämnas stoppas kön och inaktuella svar ignoreras. Ingen oskickad text töms av uppdateringen.

Verifiering: 119 kodtester PASS; regressioner för långsam pågående hämtning, sammanslagna realtime-signaler, återhämtning efter fel och avbruten kö. TypeScript och produktionsbygge PASS. Verkligt Realtime-test mellan två syntetiska konton PASS; testmeddelandet borttaget och kontrollerat. Det är inte en fysisk iPhone/PWA-verifiering och fastställer inte exakt vilken anslutningsstörning användaren hade.
