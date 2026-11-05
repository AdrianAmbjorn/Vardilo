export function greetingForHour(hour: number) {
  if (hour < 5) return "Hej";
  if (hour < 10) return "God morgon";
  if (hour < 12) return "God förmiddag";
  if (hour < 18) return "God eftermiddag";
  return "God kväll";
}
