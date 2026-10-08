export type NormalizedSlipResult =
  | {
      state: 'verified';
      provider: 'easyslip';
      providerRequestId: string | null;
      transactionRef: string | null;
      transactionDate: string | null;
      amount: number | null;
      receiverMatched: boolean;
      amountMatched: boolean;
      duplicate: boolean;
      safeProviderData: Record<string, unknown>;
    }
  | {
      state: 'pending';
      provider: 'easyslip';
      code: string;
      message: string;
    }
  | {
      state: 'rejected';
      provider: 'easyslip';
      code: string;
      message: string;
    };

export interface VerifySlipInput {
  image: File;
  expectedAmount: number;
  remark: string;
}
