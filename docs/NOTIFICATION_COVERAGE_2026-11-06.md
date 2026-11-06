# Utökade aktivitetsnotiser

Migration shared_activity_notifications (20261106174834) är applicerad i Supabase. Endast en ny privat triggerfunktion och tre nya triggers läggs till; tidigare funktioner, policyer och användardata ändras inte.

- Ny lista: övriga medlemmar i samma familj.
- Ny listpunkt: övriga medlemmar i samma familj.
- Punkt ändras till klar: övriga medlemmar i samma familj. Upprepad oförändrad uppdatering ger ingen extra notis. Återöppning ger ingen notis.
- Uppgift ändras från öppen till klar: föräldrar/admin i samma familj, utom den som utförde ändringen. Barnets syskon får inte denna notis.
- Ingen notifiering för aktören själv. Ändringar utan en autentiserad familjemedlem skapar ingen aktivitetspush. Inga historiska händelser skickas retroaktivt.

Notiserna använder befintlig privat notifications-tabell och dess RLS, befintlig notissida och global oläst-avisering. Pushkön har senare samma dag utökats genom migration 20261106203054. Dessa aktiviteter kan nu ge push på registrerade enheter. Fysisk visning/OS-leverans återstår att verifiera. Privata budgetar, sparplaner och presentreservationer omfattas inte av de nya triggerna.

Verifiering: tests/shared-activity-notifications.integration.sql kördes i en transaktion med ROLLBACK och passerade. Kontrollerar listskapande, punkt/klarmarkering, ingen egen notis, ingen extra notis vid oförändrad uppdatering, föräldramottagare för klar uppgift och familjeavgränsning. Inga testposter eller testnotiser sparades. 100 befintliga kodtester passerar. Inga nya säkerhetsadvisories; tidigare öppna leverantörspunkter kvarstår.

Återställningsmöjlighet: ta endast bort de tre nya triggerna notify_list_created (family_lists), notify_list_item_activity (family_list_items), notify_task_completed (family_tasks), därefter vardilo_private.notify_shared_activity(). Lämna alla notifications-rader och övriga tabeller kvar. Detta återställer tidigare täckning utan att radera användardata. Ingen full databackup eller återläsningsövning påstås.
