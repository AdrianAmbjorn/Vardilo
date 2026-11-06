import LegalDocument from "../components/legal-document";
import { privacySections } from "@/lib/legal-content";
export default function PrivacyPage(){return <LegalDocument title="Integritet och personuppgifter" sections={privacySections}/>;}
