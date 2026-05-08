declare module "sslcommerz-lts" {
  interface SSLCommerzInitData {
    total_amount: number;
    currency: string;
    tran_id: string;
    success_url: string;
    fail_url: string;
    cancel_url: string;
    ipn_url?: string;
    shipping_method: string;
    product_name: string;
    product_category: string;
    product_profile: string;
    cus_name: string;
    cus_email: string;
    cus_add1: string;
    cus_city: string;
    cus_country: string;
    cus_phone: string;
    ship_name: string;
    ship_add1: string;
    ship_city: string;
    ship_country: string;
    ship_postcode: string;
    value_a?: string;
    value_b?: string;
    value_c?: string;
    value_d?: string;
    [key: string]: unknown;
  }

  interface SSLCommerzInitResponse {
    GatewayPageURL?: string;
    status?: string;
    failedreason?: string;
    [key: string]: unknown;
  }

  interface SSLCommerzValidateResponse {
    status: string;
    tran_id?: string;
    val_id?: string;
    amount?: string;
    store_amount?: string;
    card_type?: string;
    [key: string]: unknown;
  }

  class SSLCommerzPayment {
    constructor(storeId: string, storePassword: string, isLive: boolean);
    init(data: SSLCommerzInitData): Promise<SSLCommerzInitResponse>;
    validate(data: { val_id: string }): Promise<SSLCommerzValidateResponse>;
  }

  export default SSLCommerzPayment;
}
