export interface CustomerDeliveryAddress {
  address_line_1: string;
  address_line_2: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
  map_url: string;
  instructions: string;
}

export const EMPTY_DELIVERY_ADDRESS: CustomerDeliveryAddress = {
  address_line_1: '',
  address_line_2: '',
  subdistrict: '',
  district: '',
  province: '',
  postal_code: '',
  map_url: '',
  instructions: '',
};

const FIELD_LIMITS: Record<keyof CustomerDeliveryAddress, number> = {
  address_line_1: 200,
  address_line_2: 200,
  subdistrict: 120,
  district: 120,
  province: 120,
  postal_code: 20,
  map_url: 2048,
  instructions: 500,
};

/** Keep an empty profile address as SQL NULL and trim saved values. */
export function normalizeDeliveryAddress(
  address: Partial<CustomerDeliveryAddress> | null | undefined,
): CustomerDeliveryAddress | null {
  if (!address) return null;

  const normalized: CustomerDeliveryAddress = {
    address_line_1: String(address.address_line_1 ?? '').trim(),
    address_line_2: String(address.address_line_2 ?? '').trim(),
    subdistrict: String(address.subdistrict ?? '').trim(),
    district: String(address.district ?? '').trim(),
    province: String(address.province ?? '').trim(),
    postal_code: String(address.postal_code ?? '').trim(),
    map_url: String(address.map_url ?? '').trim(),
    instructions: String(address.instructions ?? '').trim(),
  };

  return Object.values(normalized).some(Boolean) ? normalized : null;
}

/** Validate optional saved-address input before writing to the profile. */
export function validateSavedDeliveryAddress(
  address: CustomerDeliveryAddress,
): string | null {
  for (const field of Object.keys(FIELD_LIMITS) as Array<keyof CustomerDeliveryAddress>) {
    if (address[field].length > FIELD_LIMITS[field]) {
      return 'A delivery address field is too long.';
    }
  }

  if (address.map_url) {
    try {
      const parsed = new URL(address.map_url);
      if (parsed.protocol !== 'https:') return 'The map link must use HTTPS.';
    } catch {
      return 'Enter a valid HTTPS map link.';
    }
  }

  return null;
}

/** Checkout must call this and request any missing required fields. */
export function getDeliveryAddressCheckoutMissingFields(
  address: Partial<CustomerDeliveryAddress> | null | undefined,
): Array<keyof CustomerDeliveryAddress> {
  const required: Array<keyof CustomerDeliveryAddress> = [
    'address_line_1',
    'subdistrict',
    'district',
    'province',
    'postal_code',
  ];
  return required.filter((field) => !address?.[field]?.trim());
}
