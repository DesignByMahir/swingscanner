import type { ExtensionLabel } from "@/types/domain";

export const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

export const extensionLabel = (score: number): ExtensionLabel => {
  if (score >= 70) return "Avoid / Chasing";
  if (score >= 50) return "Very Extended";
  if (score >= 30) return "Slightly Extended";
  return "Clean";
};

export const gradeScore = (score: number) => {
  if (score >= 90) return "A+" as const;
  if (score >= 80) return "A" as const;
  if (score >= 70) return "B" as const;
  if (score >= 60) return "Watch" as const;
  return "Avoid" as const;
};
