export type PaymentProviderMode =
  | 'kshop_master'
  | 'stripe_promptpay'
  | 'promptpay_legacy'
  | 'kshop_easyslip';

export type PaymentProviderCapabilities = {
  requiresSlipUpload: boolean;
  supportsMobileHandoff: boolean;
  autoConfirmsWithoutSlip: boolean;
};

export type PaymentProviderDefinition = {
  mode: PaymentProviderMode;
  label: string;
  shortLabel: string;
  description: string;
  adminVisible: boolean;
  minimumAmountThb?: number;
  recommended?: boolean;
  fallback?: boolean;
  capabilities: PaymentProviderCapabilities;
};

export const PAYMENT_PROVIDERS: Record<PaymentProviderMode, PaymentProviderDefinition> = {
  kshop_master: {
    mode: 'kshop_master',
    label: 'K SHOP + EasySlip',
    shortLabel: 'K SHOP',
    description: 'Direct to the JOKO K SHOP account. Customer pays the merchant QR, uploads the bank slip, and EasySlip verifies the payment automatically.',
    adminVisible: true,
    recommended: true,
    capabilities: {
      requiresSlipUpload: true,
      supportsMobileHandoff: true,
      autoConfirmsWithoutSlip: false,
    },
  },
  stripe_promptpay: {
    mode: 'stripe_promptpay',
    label: 'Stripe PromptPay',
    shortLabel: 'Stripe',
    description: 'Stripe generates the exact-amount PromptPay QR and confirms successful payment to JOKO automatically by signed webhook. No slip upload is required.',
    adminVisible: true,
    minimumAmountThb: 10,
    capabilities: {
      requiresSlipUpload: false,
      supportsMobileHandoff: false,
      autoConfirmsWithoutSlip: true,
    },
  },
  promptpay_legacy: {
    mode: 'promptpay_legacy',
    label: 'Legacy PromptPay',
    shortLabel: 'Legacy PromptPay',
    description: 'Emergency fallback using the existing server-side PromptPay identity and EasySlip verification.',
    adminVisible: true,
    fallback: true,
    capabilities: {
      requiresSlipUpload: true,
      supportsMobileHandoff: true,
      autoConfirmsWithoutSlip: false,
    },
  },
  kshop_easyslip: {
    mode: 'kshop_easyslip',
    label: 'K SHOP via EasySlip generator',
    shortLabel: 'Experimental K SHOP',
    description: 'Retained only for backwards compatibility. This experimental generator previously produced a merchant identity that did not match the genuine K SHOP registration.',
    adminVisible: false,
    capabilities: {
      requiresSlipUpload: true,
      supportsMobileHandoff: true,
      autoConfirmsWithoutSlip: false,
    },
  },
};

export const CUSTOMER_PAYMENT_PROVIDERS = Object.values(PAYMENT_PROVIDERS)
  .filter((provider) => provider.adminVisible);

export function getPaymentProvider(mode: PaymentProviderMode): PaymentProviderDefinition {
  return PAYMENT_PROVIDERS[mode];
}

export function normalizePaymentProviderMode(value: unknown): PaymentProviderMode {
  return value === 'stripe_promptpay'
    ? 'stripe_promptpay'
    : value === 'kshop_master'
      ? 'kshop_master'
      : value === 'kshop_easyslip'
        ? 'kshop_easyslip'
        : 'promptpay_legacy';
}
