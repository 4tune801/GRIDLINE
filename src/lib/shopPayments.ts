export type ShopCountry =
  | 'Nigeria'
  | 'Ghana'
  | 'Kenya'
  | 'South Africa'
  | 'USA'
  | 'UK'
  | 'Other';

export type ShopGateway = 'paystack' | 'flutterwave';

export type PaystackChannel = 'card' | 'bank' | 'ussd' | 'mobile_money' | 'bank_transfer';

export interface ShopPackage {
  coins: 1000 | 5000 | 12000;
  price: number;
  formattedPrice: string;
  title: string;
  bonusNote?: string;
}

export interface ShopCountryConfig {
  country: ShopCountry;
  currency: string;
  currencyLabel: string;
  gateways: ShopGateway[];
  paystackChannels?: PaystackChannel[];
  flutterwavePaymentOptions: string;
  acceptedMethodSet: 'nigeria' | 'africa_multi' | 'international';
  channelSummary: string;
  packages: ShopPackage[];
}

export const SHOP_COUNTRY_LIST: ShopCountry[] = [
  'Nigeria',
  'Ghana',
  'Kenya',
  'South Africa',
  'USA',
  'UK',
  'Other',
];

export const SHOP_COUNTRIES: Record<ShopCountry, ShopCountryConfig> = {
  Nigeria: {
    country: 'Nigeria',
    currency: 'NGN',
    currencyLabel: 'Nigerian Naira (₦)',
    gateways: ['paystack'],
    paystackChannels: ['card', 'bank', 'ussd', 'mobile_money', 'bank_transfer'],
    flutterwavePaymentOptions: 'card, banktransfer, ussd',
    acceptedMethodSet: 'nigeria',
    channelSummary: 'Paystack · OPay, PalmPay, Bank Transfer, USSD & Card',
    packages: [
      { coins: 1000, price: 100, formattedPrice: '₦100', title: 'Starter Pack' },
      { coins: 5000, price: 500, formattedPrice: '₦500', title: 'Circuit Pack', bonusNote: 'Popular' },
      { coins: 12000, price: 1000, formattedPrice: '₦1,000', title: 'Grand Prix Pack', bonusNote: '+2,000 Bonus' },
    ],
  },
  Ghana: {
    country: 'Ghana',
    currency: 'GHS',
    currencyLabel: 'Ghanaian Cedi (GHS)',
    gateways: ['paystack', 'flutterwave'],
    paystackChannels: ['card', 'mobile_money', 'bank'],
    flutterwavePaymentOptions: 'card, mobilemoneyghana',
    acceptedMethodSet: 'africa_multi',
    channelSummary: 'Paystack Ghana & Flutterwave · MoMo, Bank & Cards',
    packages: [
      { coins: 1000, price: 3, formattedPrice: 'GHS 3', title: 'Starter Pack' },
      { coins: 5000, price: 15, formattedPrice: 'GHS 15', title: 'Circuit Pack', bonusNote: 'Popular' },
      { coins: 12000, price: 30, formattedPrice: 'GHS 30', title: 'Grand Prix Pack', bonusNote: '+2,000 Bonus' },
    ],
  },
  Kenya: {
    country: 'Kenya',
    currency: 'KES',
    currencyLabel: 'Kenyan Shilling (KES)',
    gateways: ['paystack', 'flutterwave'],
    paystackChannels: ['card', 'mobile_money', 'bank'],
    flutterwavePaymentOptions: 'card, mpesa',
    acceptedMethodSet: 'africa_multi',
    channelSummary: 'Paystack & Flutterwave · M-Pesa, Bank & Cards',
    packages: [
      { coins: 1000, price: 130, formattedPrice: 'KES 130', title: 'Starter Pack' },
      { coins: 5000, price: 650, formattedPrice: 'KES 650', title: 'Circuit Pack', bonusNote: 'Popular' },
      { coins: 12000, price: 1300, formattedPrice: 'KES 1,300', title: 'Grand Prix Pack', bonusNote: '+2,000 Bonus' },
    ],
  },
  'South Africa': {
    country: 'South Africa',
    currency: 'ZAR',
    currencyLabel: 'South African Rand (ZAR)',
    gateways: ['paystack', 'flutterwave'],
    paystackChannels: ['card', 'bank', 'bank_transfer'],
    flutterwavePaymentOptions: 'card, account',
    acceptedMethodSet: 'africa_multi',
    channelSummary: 'Paystack & Flutterwave · EFT Bank & Cards',
    packages: [
      { coins: 1000, price: 18, formattedPrice: 'R 18', title: 'Starter Pack' },
      { coins: 5000, price: 90, formattedPrice: 'R 90', title: 'Circuit Pack', bonusNote: 'Popular' },
      { coins: 12000, price: 180, formattedPrice: 'R 180', title: 'Grand Prix Pack', bonusNote: '+2,000 Bonus' },
    ],
  },
  USA: {
    country: 'USA',
    currency: 'USD',
    currencyLabel: 'US Dollar ($)',
    gateways: ['flutterwave'],
    flutterwavePaymentOptions: 'card',
    acceptedMethodSet: 'international',
    channelSummary: 'Flutterwave International · Visa, Mastercard & Amex',
    packages: [
      { coins: 1000, price: 1, formattedPrice: '$1', title: 'Starter Pack' },
      { coins: 5000, price: 5, formattedPrice: '$5', title: 'Circuit Pack', bonusNote: 'Popular' },
      { coins: 12000, price: 10, formattedPrice: '$10', title: 'Grand Prix Pack', bonusNote: '+2,000 Bonus' },
    ],
  },
  UK: {
    country: 'UK',
    currency: 'USD',
    currencyLabel: 'US Dollar ($)',
    gateways: ['flutterwave'],
    flutterwavePaymentOptions: 'card',
    acceptedMethodSet: 'international',
    channelSummary: 'Flutterwave International · Visa, Mastercard & Amex',
    packages: [
      { coins: 1000, price: 1, formattedPrice: '$1', title: 'Starter Pack' },
      { coins: 5000, price: 5, formattedPrice: '$5', title: 'Circuit Pack', bonusNote: 'Popular' },
      { coins: 12000, price: 10, formattedPrice: '$10', title: 'Grand Prix Pack', bonusNote: '+2,000 Bonus' },
    ],
  },
  Other: {
    country: 'Other',
    currency: 'USD',
    currencyLabel: 'US Dollar ($)',
    gateways: ['flutterwave'],
    flutterwavePaymentOptions: 'card',
    acceptedMethodSet: 'international',
    channelSummary: 'Flutterwave International · Visa, Mastercard & Amex',
    packages: [
      { coins: 1000, price: 1, formattedPrice: '$1', title: 'Starter Pack' },
      { coins: 5000, price: 5, formattedPrice: '$5', title: 'Circuit Pack', bonusNote: 'Popular' },
      { coins: 12000, price: 10, formattedPrice: '$10', title: 'Grand Prix Pack', bonusNote: '+2,000 Bonus' },
    ],
  },
};

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        channels?: PaystackChannel[];
        metadata?: Record<string, unknown>;
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
    FlutterwaveCheckout?: (options: {
      public_key: string;
      tx_ref: string;
      amount: number;
      currency: string;
      payment_options: string;
      customer: { email: string; name: string };
      customizations: { title: string; description: string };
      callback: (data: { status?: string; transaction_id?: number | string; tx_ref?: string }) => void;
      onclose: () => void;
    }) => { close?: () => void };
  }
}

const loadedScripts = new Set<string>();

function loadExternalScript(src: string): Promise<void> {
  if (loadedScripts.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      loadedScripts.add(src);
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      loadedScripts.add(src);
      resolve();
    };
    script.onerror = () => reject(new Error(`Unable to load payment SDK from ${src}`));
    document.head.appendChild(script);
  });
}

export function createShopReference(gateway: ShopGateway, country: ShopCountry, coins: number): string {
  const slug = country.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `GL_${gateway === 'paystack' ? 'PS' : 'FW'}_${slug}_${coins}_${Date.now().toString(36).toUpperCase()}_${rnd}`;
}

export function readLocalCoinBalance(uid?: string | null): number {
  try {
    if (uid) {
      const perUser = localStorage.getItem(`coin_balance_${uid}`);
      if (perUser !== null) {
        const parsed = Number(perUser);
        if (Number.isFinite(parsed) && parsed >= 0) return parsed;
      }
    }
    const shared = localStorage.getItem('coin_balance');
    if (shared !== null) {
      const parsed = Number(shared);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  } catch {
    // Ignore storage restrictions
  }
  return 0;
}

export function writeLocalCoinBalance(nextBalance: number, uid?: string | null): void {
  try {
    const safe = Math.max(0, Math.round(nextBalance));
    localStorage.setItem('coin_balance', String(safe));
    if (uid) {
      localStorage.setItem(`coin_balance_${uid}`, String(safe));
    }
  } catch {
    // Ignore storage restrictions
  }
}

export type InlineCheckoutOutcome =
  | { status: 'success'; reference: string; transactionId?: string; mode: 'live' }
  | { status: 'cancelled' }
  | { status: 'no_public_key' };

export async function launchPaystackInline(params: {
  email: string;
  countryConfig: ShopCountryConfig;
  pkg: ShopPackage;
  reference: string;
}): Promise<InlineCheckoutOutcome> {
  const publicKey = (import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '').trim();
  if (!publicKey) {
    return { status: 'no_public_key' };
  }

  await loadExternalScript('https://js.paystack.co/v1/inline.js');
  if (!window.PaystackPop) {
    throw new Error('Paystack checkout script did not initialize.');
  }

  return new Promise((resolve) => {
    let settled = false;
    const handler = window.PaystackPop!.setup({
      key: publicKey,
      email: params.email,
      amount: Math.round(params.pkg.price * 100),
      currency: params.countryConfig.currency,
      ref: params.reference,
      channels: params.countryConfig.paystackChannels || ['card', 'bank', 'ussd', 'mobile_money', 'bank_transfer'],
      metadata: {
        coins: params.pkg.coins,
        country: params.countryConfig.country,
        nonRedeemable: true,
      },
      callback: (response) => {
        if (settled) return;
        settled = true;
        resolve({
          status: 'success',
          reference: response.reference || params.reference,
          mode: 'live',
        });
      },
      onClose: () => {
        if (settled) return;
        settled = true;
        resolve({ status: 'cancelled' });
      },
    });
    handler.openIframe();
  });
}

export async function launchFlutterwaveInline(params: {
  email: string;
  displayName: string;
  countryConfig: ShopCountryConfig;
  pkg: ShopPackage;
  reference: string;
}): Promise<InlineCheckoutOutcome> {
  const publicKey = (import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY || '').trim();
  if (!publicKey) {
    return { status: 'no_public_key' };
  }

  await loadExternalScript('https://checkout.flutterwave.com/v3.js');
  if (!window.FlutterwaveCheckout) {
    throw new Error('Flutterwave checkout script did not initialize.');
  }

  return new Promise((resolve) => {
    let settled = false;
    window.FlutterwaveCheckout!({
      public_key: publicKey,
      tx_ref: params.reference,
      amount: params.pkg.price,
      currency: params.countryConfig.currency,
      payment_options: params.countryConfig.flutterwavePaymentOptions,
      customer: {
        email: params.email,
        name: params.displayName,
      },
      customizations: {
        title: 'Gridline Coin Shop',
        description: `${params.pkg.coins.toLocaleString()} Non-Redeemable Coins (${params.pkg.formattedPrice})`,
      },
      callback: (data) => {
        if (settled) return;
        if (data.status === 'successful' || data.status === 'completed') {
          settled = true;
          resolve({
            status: 'success',
            reference: data.tx_ref || params.reference,
            transactionId: data.transaction_id ? String(data.transaction_id) : undefined,
            mode: 'live',
          });
        }
      },
      onclose: () => {
        if (settled) return;
        settled = true;
        resolve({ status: 'cancelled' });
      },
    });
  });
}

export async function verifyShopPaymentOnServer(params: {
  gateway: ShopGateway;
  reference: string;
  transactionId?: string;
  country: ShopCountry;
  coins: number;
  mode: 'live' | 'sandbox';
}): Promise<{ verified: boolean; mode: string; coins: number; reference: string }> {
  const res = await fetch('/api/shop/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as {
    verified?: boolean;
    mode?: string;
    coins?: number;
    reference?: string;
    error?: string;
  };
  if (!res.ok || !data.verified) {
    throw new Error(data.error || 'Payment verification failed.');
  }
  return {
    verified: true,
    mode: data.mode || params.mode,
    coins: Number(data.coins) || params.coins,
    reference: data.reference || params.reference,
  };
}
