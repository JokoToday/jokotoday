import {
  printOrderDocument,
  type PrintOrderDocumentOptions,
} from './printOrderDocument';

export type PrintReceiptOptions = Omit<PrintOrderDocumentOptions, 'documentType'>;

export function printOrderReceipt(options: PrintReceiptOptions) {
  return printOrderDocument({
    ...options,
    documentType: 'receipt',
  });
}
