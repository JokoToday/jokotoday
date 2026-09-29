import { supabase } from './supabase';

function productCodePrefix(name: string): string {
  const words = name
    .toUpperCase()
    .match(/[A-Z0-9]+/g)
    ?.filter(Boolean) || [];

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`;
  }

  const compact = words.join('');
  if (compact.length >= 2) return compact.slice(0, 2);
  if (compact.length === 1) return `${compact}X`;
  return 'PR';
}

/**
 * Suggests a human-friendly permanent public product code without writing it.
 *
 * Example: Almond Croissant -> AC101, then AC102, etc.
 * Archived/hidden products are included so historical printed QR codes are
 * never accidentally recycled.
 *
 * The database's case-insensitive unique index remains the final concurrency
 * guard if two admins ever generate the same suggestion at the same time.
 */
export async function suggestProductPublicCode(productName: string): Promise<string> {
  const prefix = productCodePrefix(productName);

  const { data, error } = await supabase
    .from('cms_products')
    .select('public_code')
    .not('public_code', 'is', null);

  if (error) throw error;

  const existingCodes = new Set(
    (data || [])
      .map((row) => String(row.public_code || '').trim().toUpperCase())
      .filter(Boolean),
  );

  let nextNumber = 101;
  const numericPattern = new RegExp(`^${prefix}(\\d+)$`);

  existingCodes.forEach((code) => {
    const match = code.match(numericPattern);
    if (!match) return;
    const numeric = Number(match[1]);
    if (Number.isFinite(numeric) && numeric >= nextNumber) {
      nextNumber = numeric + 1;
    }
  });

  let candidate = `${prefix}${nextNumber}`;
  while (existingCodes.has(candidate)) {
    nextNumber += 1;
    candidate = `${prefix}${nextNumber}`;
  }

  return candidate;
}
