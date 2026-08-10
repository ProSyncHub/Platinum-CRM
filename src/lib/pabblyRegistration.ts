export type ImportedProgram = "Webinar" | "PNP" | "Others";

export function classifyPabblyRegistration(amount: number): ImportedProgram {
  if (Math.abs(amount - 195) < 0.01) return "Webinar";
  if (Math.abs(amount - 17_500) < 0.01) return "PNP";
  return "Others";
}
