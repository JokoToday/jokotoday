/** Business inputs always mean Bangkok time, including for staff abroad. */
export function bangkokInputValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
export function bangkokInstant(input: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input))
    throw new Error("Enter a valid Bangkok date and time.");
  const date = new Date(`${input}:00+07:00`);
  if (!Number.isFinite(date.getTime()) || bangkokInputValue(date) !== input)
    throw new Error("Enter a valid Bangkok date and time.");
  return date.toISOString();
}
export function priceToSatang(input: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(input.trim()))
    throw new Error("Enter a positive price with at most two decimal places.");
  const [baht, decimals = ""] = input.trim().split(".");
  const satang = Number(baht) * 100 + Number(decimals.padEnd(2, "0"));
  if (!Number.isSafeInteger(satang) || satang <= 0 || satang > 2147483647)
    throw new Error("Price is out of range.");
  return satang;
}
