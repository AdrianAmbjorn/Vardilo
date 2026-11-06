import LegalDocument from "../components/legal-document";
import { termsSections } from "@/lib/legal-content";
export default function TermsPage(){return <LegalDocument title="Villkor för familjetestet" sections={termsSections}/>;}
