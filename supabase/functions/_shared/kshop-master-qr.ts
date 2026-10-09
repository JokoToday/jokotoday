// Shared by the regular K SHOP intent and Specials; merchant data and initiation stay intact.
function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function crc16Ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc =
        (crc & 0x8000) !== 0
          ? ((crc << 1) ^ 0x1021) & 0xffff
          : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
type TlvField = { id: string; value: string };
function parseTopLevelTlv(payload: string): TlvField[] {
  const fields: TlvField[] = [];
  let offset = 0;

  while (offset + 4 <= payload.length) {
    const id = payload.slice(offset, offset + 2);
    const lengthRaw = payload.slice(offset + 2, offset + 4);
    const length = Number(lengthRaw);
    if (!/^\d{2}$/.test(lengthRaw) || !Number.isInteger(length) || length < 0) {
      throw new Error("Invalid K SHOP master QR TLV length");
    }

    const valueStart = offset + 4;
    const valueEnd = valueStart + length;
    if (valueEnd > payload.length) {
      throw new Error("Invalid K SHOP master QR TLV boundary");
    }

    fields.push({ id, value: payload.slice(valueStart, valueEnd) });
    offset = valueEnd;
  }

  if (offset !== payload.length) {
    throw new Error("Invalid trailing data in K SHOP master QR");
  }

  return fields;
}

export function buildKShopMasterPayload(
  masterPayloadRaw: string,
  amount: number,
): string {
  const masterPayload = masterPayloadRaw.trim();
  if (!masterPayload) throw new Error("K SHOP master QR payload is empty");

  const fields = parseTopLevelTlv(masterPayload);
  const withoutCrc = fields.filter((entry) => entry.id !== "63");

  const currency = withoutCrc.find((entry) => entry.id === "53")?.value;
  const country = withoutCrc.find((entry) => entry.id === "58")?.value;
  const initiation = withoutCrc.find((entry) => entry.id === "01")?.value;

  if (currency !== "764" || country !== "TH") {
    throw new Error("K SHOP master QR is not a Thai Baht merchant QR");
  }

  if (initiation !== "11") {
    throw new Error(
      "K SHOP master QR must preserve the original static point-of-initiation method",
    );
  }

  const amountField = field("54", amount.toFixed(2));
  let insertedAmount = false;
  const rebuilt = withoutCrc
    .filter((entry) => entry.id !== "54")
    .map((entry) => {
      const encoded = field(entry.id, entry.value);
      if (entry.id === "53") {
        insertedAmount = true;
        return encoded + amountField;
      }
      return encoded;
    })
    .join("");

  if (!insertedAmount) {
    throw new Error("K SHOP master QR is missing currency field 53");
  }

  const base = rebuilt + "6304";
  return base + crc16Ccitt(base);
}
