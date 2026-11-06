# Drift, säkerhet och återställning

Checkpoint före denna release: GitHub d5994faac10ae08277fcd52cb73402fb88bc9e4a, Vercel dpl_GRcGcHDCr3uDqtKdXgDgn7VFwGyT. Databasdefinitioner och policyer före ändringen finns i schema-before-20261106.json. Inga hemligheter eller användarrader ingår där.

Ändringarna är additiva och behörighetsbegränsande. Inga befintliga användare, familjer, kalenderposter, bilder eller äldre födelseår raderas. Nya dag-/månadskolumner härleds från äldre datum, som lämnas kvar. Gamla klienter med birth_date stöds av normaliseringstriggern. Nya klienter skickar inget födelseår.

Vid incident: stoppa en felaktig ny publicering; jämför exakta commit-SHA; återställ en känd fungerande appversion endast efter kontroll att den stöder den aktuella databasmodellen. Rulla inte tillbaka till ett krav på födelseår eller aktivera gamla galleriuppladdningar av misstag. Den tidigare child-login-Edge-funktionen hade version 7; version 8 kräver vårdnadshavarbekräftelse för nya barnkonton. Befintliga lösenord ändras inte.

Databasåterställning ska först repeteras i en separat miljö. Återställ inte hela produktionen ovanpå nya användardata. Rekonstruera berörda funktioner och ACL från checkpointen för en riktad återställning; schemafilen innehåller inte en komplett pg_dump. Låt extra kolumner ligga kvar om en kodändring återställs. De innehåller nya, legitima uppgifter som inte får kastas.

Full databas- och Storage-backup samt återläsning är inte verifierad här. Supabase-databasbackup omfattar inte automatiskt själva Storage-filerna. Kontrollera planens backupfunktioner och separata filexporter innan riskfylld dataoperation. Kostnadsökande backup/PITR har inte aktiverats.

Säkerhetsgranskningen fann: alla public-tabeller har RLS; båda bildbucketarna är privata. Nya galleriuppladdningar och oanvända kluring-RPC:er är stängda. Triggerfunktioner exponeras inte längre för klientroller. Avsiktliga authenticated SECURITY DEFINER-RPC:er behöver fortsatt användar-/familjekontroll och regressionstester; de är inte automatiskt fel bara för att en rådgivare listar dem.

Kvarstående leverantörspunkter: skydd mot läckta lösenord avstängt; pg_net-extension i public; avsiktliga interna tabeller med RLS utan klientpolicy. Ändra inte dessa blint: de två sista behöver bedömas med hänsyn till interna jobb och leverantörens stöd. Se https://supabase.com/docs/guides/auth/password-security och databasens aktuella rådgivare.

Testidentiteter skapas med en unik audit-markör, aldrig med verkliga familjers konton. Testhemligheter och sessionsuppgifter ligger endast under ignorerade .audit/. Städa endast exakt dokumenterade test-ID:n och testfamilj; aldrig generella namnmatchningar eller hela auth-/Storage-tabeller.
