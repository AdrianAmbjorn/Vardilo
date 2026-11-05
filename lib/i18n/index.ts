import { english } from "./english";
export type Language = "sv" | "en";
export function languageFrom(value: unknown): Language { return typeof value === "string" && /^en(?:[-_]|$)/i.test(value) ? "en" : "sv"; }
export function translate(text: string, language: Language): string { return language === "en" && Object.hasOwn(english, text) ? english[text] : text; }
