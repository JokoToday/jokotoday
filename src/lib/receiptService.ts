import { supabase } from './supabase';
import type {
  PrintableOrder,
  PrintOrderCopy,
  PrintOrderLanguage,
} from './printOrderDocument';

export type OrderReceiptSnapshot = {
  version: number;
  receipt_number: string;
  issued_at: string;
  customer_received_at: string;
  order: PrintableOrder;
  pickup_labels?: Partial<Record<PrintOrderLanguage, string>>;
  pickup_location_names?: Partial<Record<PrintOrderLanguage, string>>;
  status_labels?: Partial<Record<PrintOrderLanguage, string>>;
  payment_descriptions?: Partial<Record<PrintOrderLanguage, string>>;
  copy_by_language?: Partial<Record<PrintOrderLanguage, Partial<PrintOrderCopy>>>;
  next_order_url?: string;
};

export type OrderReceiptRecord = {
  id: string;
  order_id: string;
  customer_id: string | null;
  receipt_number: string;
  issued_at: string;
  document_version: number;
  snapshot: OrderReceiptSnapshot;
};

export async function getReceiptForOrder(orderId: string): Promise<OrderReceiptRecord | null> {
  const { data, error } = await supabase
    .from('order_receipts')
    .select('id, order_id, customer_id, receipt_number, issued_at, document_version, snapshot')
    .eq('order_id', orderId)
    .maybeSingle();

  if (error) throw error;
  return data as OrderReceiptRecord | null;
}

export async function getReceiptsForOrders(orderIds: string[]): Promise<Record<string, OrderReceiptRecord>> {
  if (orderIds.length === 0) return {};

  const { data, error } = await supabase
    .from('order_receipts')
    .select('id, order_id, customer_id, receipt_number, issued_at, document_version, snapshot')
    .in('order_id', orderIds);

  if (error) throw error;

  return ((data || []) as OrderReceiptRecord[]).reduce<Record<string, OrderReceiptRecord>>((map, receipt) => {
    map[receipt.order_id] = receipt;
    return map;
  }, {});
}
