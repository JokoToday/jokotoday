import type { NormalizedSlipResult, VerifySlipInput } from './provider.ts';

type EasySlipPayload = {
  success?: boolean;
  message?: string;
  error?: { code?: string; message?: string };
  data?: {
    isDuplicate?: boolean;
    matchedAccount?: {
      bank?: { nameEn?: string; nameTh?: string; shortCode?: string };
      nameTh?: string;
      nameEn?: string;
      type?: string;
      bankNumber?: string;
    } | null;
    amountInOrder?: number;
    amountInSlip?: number;
    isAmountMatched?: boolean;
    rawSlip?: {
      payload?: string;
      transRef?: string;
      date?: string;
      countryCode?: string;
      amount?: { amount?: number };
      receiver?: {
        bank?: { name?: string; short?: string };
      };
    };
  };
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function verifyWithEasySlip(input: VerifySlipInput): Promise<NormalizedSlipResult> {
  const form = new FormData();
  form.append('image', input.image, input.image.name || 'payment-slip');
  form.append('remark', input.remark.slice(0, 255));
  form.append('matchAccount', 'true');
  form.append('matchAmount', input.expectedAmount.toFixed(2));
  form.append('checkDuplicate', 'true');

  let response: Response;
  try {
    response = await fetch('https://api.easyslip.com/v2/verify/bank', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${requiredEnv('EASYSLIP_API_KEY')}`,
      },
      body: form,
    });
  } catch {
    return {
      state: 'pending',
      provider: 'easyslip',
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Payment verification is temporarily unavailable.',
    };
  }

  const payload = await response.json().catch(() => null) as EasySlipPayload | null;

  if (!response.ok || !payload?.success) {
    const code = payload?.error?.code || 'EASYSLIP_ERROR';
    const providerMessage = payload?.error?.message || 'EasySlip could not verify this slip.';

    if (code === 'SLIP_PENDING' || response.status >= 500) {
      return {
        state: 'pending',
        provider: 'easyslip',
        code,
        message: code === 'SLIP_PENDING'
          ? 'The bank transaction is not available yet.'
          : 'Payment verification is temporarily unavailable.',
      };
    }

    return {
      state: 'rejected',
      provider: 'easyslip',
      code,
      message: providerMessage,
    };
  }

  const data = payload.data || {};
  const rawSlip = data.rawSlip || {};
  const amount = Number.isFinite(Number(data.amountInSlip))
    ? Number(data.amountInSlip)
    : Number.isFinite(Number(rawSlip.amount?.amount))
      ? Number(rawSlip.amount?.amount)
      : null;

  return {
    state: 'verified',
    provider: 'easyslip',
    providerRequestId: null,
    transactionRef: typeof rawSlip.transRef === 'string' && rawSlip.transRef.trim()
      ? rawSlip.transRef.trim()
      : null,
    transactionDate: typeof rawSlip.date === 'string' && rawSlip.date.trim()
      ? rawSlip.date.trim()
      : null,
    amount,
    receiverMatched: Boolean(data.matchedAccount),
    amountMatched: data.isAmountMatched === true,
    duplicate: data.isDuplicate === true,
    safeProviderData: {
      message: payload.message || null,
      bankShortCode: data.matchedAccount?.bank?.shortCode || null,
      matchedAccountType: data.matchedAccount?.type || null,
    },
  };
}
