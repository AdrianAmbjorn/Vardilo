# Läsbar text i push

Användaren begärde uttryckligen rubrik/text direkt i pushnotisen. Edge-worker läser den fortfarande olästa notisraden innan leverans, och för chatten hämtas full meddelandetext med verifierad familjekoppling. Borttagna/lästa notiser och saknade chattmeddelanden skickas inte efter köhämtningen. Inga texter loggas.

Payloadens titel/body begränsas med hänsyn till Unicode och JSON-kodning så att Web Push-formatet ryms. Service-worker visar dem som text och fungerar även med äldre tag-only-payload. Den uppdateras vid ett nytt appbesök utan ny behörighetsdialog. Push öppnar fortfarande /notiser.

Aktiva pushkategorier: oläst chatt inklusive stora meddelanden, kalenderpåminnelser, födelsedagar, nya listor, nya/avbockade listpunkter, tilldelade uppgifter och klarmarkerade uppgifter. Uppgiftsklarmarkering går endast till föräldrar/admin; tilldelning till ansvarig person. Push måste vara påslaget per enhet under Notiser. OS-inställningar och faktisk bakgrundsvisning är inte slutverifierade.

116 kodtester passerar, inklusive full chatttext i mockad workerleverans, notifiering redan läst/borttagen, Unicode/JSON-storlek och faktisk showNotification-inmatning i service-worker-test. Byggning/typkontroll körs separat. Detta är inte ett test mot verklig Apple/Google-leverans eller fysisk telefon.

Återställning: tidigare Edge-version 1 och källan på GitHub db179138d61502a9cad10d0cd7163285d8858074 kan återpubliceras utan att ändra notiser, prenumerationer eller nycklar. Behåll verify_jwt=false tillsammans med befintlig obligatorisk worker-tokenkontroll. Appens tidigare generiska service-worker kan återställas separat. Inga användardata behöver raderas.
