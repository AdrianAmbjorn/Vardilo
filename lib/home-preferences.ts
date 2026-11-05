export const homeSections = [
  { id: "countdown", label: "Nedräkning", emoji: "🎉" },
  { id: "xp", label: "Mina XP och mitt mål", emoji: "⭐" },
  { id: "calendar", label: "Nästa händelse", emoji: "📅" },
  { id: "help", label: "Hjälp i familjen", emoji: "🤝" },
  { id: "lists", label: "Listor", emoji: "📝" },
  { id: "wishlists", label: "Önskelistor", emoji: "🎁" },
  { id: "savings", label: "Mina pengar", emoji: "🐷" },
  { id: "budget", label: "Vår budget", emoji: "💰" },
  { id: "meals", label: "Veckans mat", emoji: "🍽️" },
  { id: "tasks", label: "Uppgifter", emoji: "✅" },
  { id: "chat", label: "Familjechat", emoji: "💬" },
] as const;
export type HomeSectionId = typeof homeSections[number]["id"];
export function readHiddenSections(value: unknown): HomeSectionId[] {
  if (!Array.isArray(value)) return [];
  return homeSections.filter(section => value.includes(section.id)).map(section => section.id);
}
