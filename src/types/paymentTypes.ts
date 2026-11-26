export type PaymentMethod = "payos" | "cod";
export type PaymentType = "order_payment" | "subscription_payment" | "refund";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export interface CreatePaymentDTO {
  order_id?: number;
  subscription_id?: number;
  return_url?: string;
  cancel_url?: string;
}

export interface PayosWebhookPayload {
  code: string;
  desc: string;
  success?: boolean;
  data: {
    orderCode: number;
    amount: number;
    description: string;
    accountNumber: string;
    reference: string;
    transactionDateTime: string;
    currency: string;
    paymentLinkId: string;
    code: string;
    desc: string;
    counterAccountBankId?: string | null;
    counterAccountBankName?: string | null;
    counterAccountName?: string | null;
    counterAccountNumber?: string | null;
    virtualAccountName?: string | null;
    virtualAccountNumber?: string | null;
  };
  signature: string;
}

export interface PayosReturnQuery {
  code?: string;
  id?: string;
  cancel?: string;
  status?: string;
  orderCode?: string;
  format?: "json" | "redirect";
}
