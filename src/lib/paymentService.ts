import { supabase } from './supabase';

export type PaymentQrMode = 'promptpay_legacy' | 'kshop_easyslip' | 'kshop_master';

export type PaymentSettings = {
  online_promptpay_enabled: boolean;
  payment_window_minutes: number;
  payment_qr_mode: PaymentQrMode;
};

export type PaymentTransaction = {
  id: string;
  order_id: string;
  customer_id: string;
  provider: string;
  rail: string;
  currency: string;
  amount_due: number;
  status: 'pending' | 'verifying' | 'verified' | 'failed' | 'expired' | 'cancelled';
  provider_transaction_ref?: string | null;
  expires_at: string;
  verified_at?: string | null;
  last_error_code?: string | null;
  last_error_message?: string | null;
};

export type PromptPayIntent = {
  state: 'pending' | 'verified' | 'expired';
  paymentTransactionId: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  expiresAt: string;
  promptPayPayload?: string;
  qrMode?: PaymentQrMode;
};

export type PaymentVerificationResult = {
  state: 'verified' | 'pending' | 'rejected' | 'expired';
  payment_status?: string;
  order_status?: string;
  paymentTransactionId?: string;
  amountPaid?: number;
  amountInSlip?: number;
  expectedAmount?: number;
  transRef?: string | null;
  code?: string;
  message?: string;
  error?: string;
};

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const { data, error } = await supabase
    .from('payment_settings')
    .select('online_promptpay_enabled, payment_window_minutes, payment_qr_mode')
    .eq('id', true)
    .maybeSingle();

  if (error) throw error;

  return {
    online_promptpay_enabled: Boolean(data?.online_promptpay_enabled),
    payment_window_minutes: Number(data?.payment_window_minutes) || 60,
    payment_qr_mode: data?.payment_qr_mode === 'kshop_master' ? 'kshop_master' : data?.payment_qr_mode === 'kshop_easyslip' ? 'kshop_easyslip' : 'promptpay_legacy',
  };
}

export async function createOrGetPaymentTransaction(orderId: string): Promise<PaymentTransaction> {
  const { data, error } = await supabase.rpc('create_or_get_payment_transaction_v1', {
    p_order_id: orderId,
  });

  if (error) throw error;
  if (!data?.id) throw new Error('Could not prepare this payment.');

  return {
    ...data,
    amount_due: Number(data.amount_due),
  } as PaymentTransaction;
}

export async function getPromptPayIntent(paymentTransactionId: string): Promise<PromptPayIntent> {
  const { data, error } = await supabase.functions.invoke('promptpay-payment-intent', {
    body: { paymentTransactionId },
  });

  if (error) throw error;
  if (!data?.paymentTransactionId) throw new Error(data?.error || 'Could not prepare PromptPay QR.');

  return data as PromptPayIntent;
}

export async function verifyPaymentSlip(
  paymentTransactionId: string,
  image: File,
): Promise<PaymentVerificationResult> {
  const formData = new FormData();
  formData.append('paymentTransactionId', paymentTransactionId);
  formData.append('image', image);

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Your session has expired. Please sign in again.');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xvhualoeboobulwgmkla.supabase.co';
  const response = await fetch(`${supabaseUrl}/functions/v1/verify-payment-slip`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  const payload = await response.json().catch(() => null) as PaymentVerificationResult | null;

  if (!payload) {
    throw new Error('Payment verification did not return a response.');
  }

  if (!response.ok && response.status !== 202) {
    const error = new Error(payload.message || payload.error || 'Payment verification failed.');
    Object.assign(error, { paymentResult: payload });
    throw error;
  }

  return payload;
}


export type PaymentHandoff = {
  handoffUrl: string;
  expiresAt: string;
  amount: number;
  currency: string;
  orderNumber: string;
};

export type PaymentHandoffState = {
  state: 'pending' | 'verifying' | 'verified' | 'expired' | 'cancelled';
  orderNumber: string;
  amount: number;
  currency: string;
  expiresAt: string;
  pickupDate?: string | null;
};

export async function createPaymentHandoff(paymentTransactionId: string): Promise<PaymentHandoff> {
  const { data, error } = await supabase.functions.invoke('create-payment-handoff', {
    body: { paymentTransactionId },
  });

  if (error) throw error;
  if (!data?.handoffUrl) throw new Error(data?.error || 'Could not create phone payment handoff.');
  return data as PaymentHandoff;
}

export async function getPaymentTransactionStatus(paymentTransactionId: string): Promise<PaymentTransaction['status']> {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('status')
    .eq('id', paymentTransactionId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.status) throw new Error('Payment status is unavailable.');
  return data.status as PaymentTransaction['status'];
}

export async function resolvePaymentHandoff(token: string): Promise<PaymentHandoffState> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xvhualoeboobulwgmkla.supabase.co';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const response = await fetch(`${supabaseUrl}/functions/v1/resolve-payment-handoff`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(anonKey ? { apikey: anonKey } : {}),
    },
    body: JSON.stringify({ token }),
  });

  const payload = await response.json().catch(() => null) as (PaymentHandoffState & { error?: string }) | null;
  if (!payload || !response.ok) throw new Error(payload?.error || 'Could not open this payment handoff.');
  return payload;
}

export async function verifyPaymentHandoffSlip(
  token: string,
  image: File,
): Promise<PaymentVerificationResult> {
  const formData = new FormData();
  formData.append('token', token);
  formData.append('image', image);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xvhualoeboobulwgmkla.supabase.co';
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const response = await fetch(`${supabaseUrl}/functions/v1/verify-payment-handoff-slip`, {
    method: 'POST',
    headers: anonKey ? { apikey: anonKey } : undefined,
    body: formData,
  });

  const payload = await response.json().catch(() => null) as PaymentVerificationResult | null;
  if (!payload) throw new Error('Payment verification did not return a response.');

  if (!response.ok && response.status !== 202) {
    throw new Error(payload.message || payload.error || 'Payment verification failed.');
  }

  return payload;
}
