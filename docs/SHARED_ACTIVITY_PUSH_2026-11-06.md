# Push för listor och uppgifter

Migration 20261106203054 är applicerad. Endast claim_calendar_push-definitionen utökas. Inga tabellrader eller RLS-policyer ändras. Före ändringen lästes produktionsdefinitionen; motsvarande tidigare funktion finns i 20261106185728_family_announcements.sql (återställ endast funktionen, kör inte hela den gamla migrationen).

Nya tillåtna händelser: ny lista, ny listpunkt, avbockad punkt, ny tilldelad uppgift och klar uppgift. Listkällan måste fortfarande finnas i samma familj. Tilldelad uppgift kräver aktuell ansvarig mottagare, ännu öppen uppgift och annan skapare än mottagaren. Klar uppgift kräver admin/föräldraroll och faktiskt klarmarkerad källuppgift. Ingen egen list- eller klarmarkeringspush. Tidigare chatt-, kalender- och födelsedagsvillkor bevaras. Privata budget-/sparnotiser och generella systemnotiser omfattas inte.

Befintlig Edge-worker skickar rubrik och text. Registrerad enhet och aktiv push krävs. Köjobb kör normalt varje minut; fysisk iOS/Android-leverans är inte verifierad.

Test: tests/shared-activity-push.integration.sql PASS med ROLLBACK. Kontrollerar fem förväntade leveranser (lista, listpunkt, avbockad punkt, klar uppgift till förälder och ny tilldelning till barn), ingen omedelbar dubbelhämtning, nekad klarmarkering till barn, nekad privat budgetnotis samt saknad listkälla. Alla testposter, prenumerationer och leveranser rullades tillbaka. Inga nya security-advisories; tidigare öppna leverantörspunkter kvarstår.

Återställning: återpublicera endast den föregående claim_calendar_push-funktionen och dess service_role-åtkomst. Behåll alla notiser, prenumerationer, leveranshistorik och list-/uppgiftsdata. Ingen radering behövs.
