export const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);

export const compact = (value: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export const percent = (value: number, digits = 2) =>
  `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;

export const scoreTone = (score: number) =>
  score >= 80 ? "positive" : score >= 60 ? "warning" : "negative";
