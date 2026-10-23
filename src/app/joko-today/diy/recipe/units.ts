export type UnitSystem = "metric" | "us";
const ounce = 28.349523125;
const fluidOunce = 29.5735295625;
const definitions: Record<string, ["mass" | "volume" | "temperature", number, UnitSystem]> = {
  g: ["mass", 1, "metric"], gram: ["mass", 1, "metric"], grams: ["mass", 1, "metric"],
  "克": ["mass", 1, "metric"], "กรัม": ["mass", 1, "metric"],
  kg: ["mass", 1000, "metric"], mg: ["mass", 0.001, "metric"],
  oz: ["mass", ounce, "us"], ounce: ["mass", ounce, "us"], ounces: ["mass", ounce, "us"],
  lb: ["mass", 16 * ounce, "us"], lbs: ["mass", 16 * ounce, "us"],
  ml: ["volume", 1, "metric"], "毫升": ["volume", 1, "metric"], "มล.": ["volume", 1, "metric"],
  l: ["volume", 1000, "metric"], litre: ["volume", 1000, "metric"], liter: ["volume", 1000, "metric"],
  "us fl oz": ["volume", fluidOunce, "us"],
  "°c": ["temperature", 1, "metric"], "℃": ["temperature", 1, "metric"],
  "°f": ["temperature", 1, "us"], "℉": ["temperature", 1, "us"],
};
function number(value: string): number | null {
  const match = value.trim().match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (match) return +match[3] > 0 ? +(match[1] || 0) + +match[2] / +match[3] : null;
  if (!/^-?\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function rounded(value: number, digits = 2) {
  return String(Number(value.toFixed(digits)));
}
/** Conversion is display-only. Unknown/ambiguous units (including bare fl oz) stay unchanged. */
export function displayQuantity(amount: string, unit: string | null, system: UnitSystem): string {
  const original = `${amount} ${unit ?? ""}`.trim();
  const key = (unit ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const def = definitions[key];
  if (!def || def[2] === system) return original;
  const range = amount.trim().match(/^(-?\d+(?:\.\d+)?)\s*[–—-]\s*(-?\d+(?:\.\d+)?)$/);
  const bounds = range ? [range[1], range[2]] : [amount.trim()];
  const values = bounds.map(number);
  if (values.some(v => v === null || (v < 0 && def[0] !== "temperature"))) return original;
  const converted = (values as number[]).map(n => def[0] === "temperature"
    ? system === "us" ? n * 9 / 5 + 32 : (n - 32) * 5 / 9
    : n * def[1] / (system === "metric" ? 1 : def[0] === "mass" ? ounce : fluidOunce));
  const digits = def[0] === "temperature" ? 0 : 2;
  if (converted.some(n => n > 0 && Number(n.toFixed(digits)) === 0)) return original;
  const target = def[0] === "temperature" ? system === "us" ? "°F" : "°C"
    : system === "metric" ? def[0] === "mass" ? "g" : "ml" : def[0] === "mass" ? "oz" : "US fl oz";
  const result = `≈ ${converted.map(n => rounded(n, digits)).join("–")} ${target}`;
  // Keep small gram amounts readable instead of relying on rounded fractions of an ounce.
  if (def[0] === "mass" && system === "us" && values.some(n => n! * def[1] < 10)) {
    const grams = values.map(n => rounded(n! * def[1], 4)).join("–");
    return `${result} (${grams} g)`;
  }
  return result;
}
/** Convert explicit units only; counts, timings, pan capacities and source evidence are not inferred. */
export function displayInstructions(text: string, system: UnitSystem): string {
  return text.replace(/(?<![\d./-])(-?\d+(?:\.\d+)?(?:\s*[–—-]\s*\d+(?:\.\d+)?)?)\s*(°\s*[CF]|℃|℉|US\s+fl\s+oz|grams?\b|ounces?\b|kg\b|mg\b|g\b|oz\b|ml\b|克|กรัม|毫升)/gi,
    (original, amount: string, unit: string) => {
      const output = displayQuantity(amount, unit.replace(/°\s+/, "°"), system);
      // Preserve the source wording/spacing whenever no conversion is needed.
      return output.startsWith("≈ ") ? output : original;
    });
}
