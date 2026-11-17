import { useEffect, useState } from 'react';
import { Check, Coins, CreditCard, Globe, Lock, ShieldCheck, Smartphone, X } from 'lucide-react';
import { creditShopCoins } from '../lib/firebase';
import {
  SHOP_COUNTRIES,
  SHOP_COUNTRY_LIST,
  createShopReference,
  launchFlutterwaveInline,
  launchPaystackInline,
  readLocalCoinBalance,
  verifyShopPaymentOnServer,
  writeLocalCoinBalance,
  type ShopCountry,
  type ShopGateway,
  type ShopPackage,
} from '../lib/shopPayments';
import type { UserPrivateProfile } from '../types/racing';

interface CoinShopProps {
  profile: UserPrivateProfile | null;
  onSignIn: () => void;
  onCoinsCredited?: (coinsAdded: number, newBalance: number, priceLabel: string, gatewayLabel: string) => void;
}

interface SandboxCheckoutState {
  gateway: ShopGateway;
  pkg: ShopPackage;
  reference: string;
  selectedChannel: string;
}

function getNigeriaChannels(gatewayLabel: 'paystack'): Array<{ id: string; label: string; detail: string }> {
  void gatewayLabel;
  return [
    { id: 'opay', label: 'OPay Wallet', detail: 'Instant mobile wallet approval' },
    { id: 'palmpay', label: 'PalmPay', detail: 'Pay directly via PalmPay app' },
    { id: 'bank_transfer', label: 'Bank Transfer', detail: 'One-time virtual NUBAN account' },
    { id: 'ussd', label: 'USSD Code', detail: '*737# / *901# / *894# quick dial' },
    { id: 'card', label: 'Debit / Verve Card', detail: 'Local Naira Visa, Mastercard & Verve' },
  ];
}

function getSandboxChannels(country: ShopCountry, gateway: ShopGateway): Array<{ id: string; label: string; detail: string }> {
  if (country === 'Nigeria') {
    return getNigeriaChannels('paystack');
  }
  if (country === 'Ghana') {
    return [
      { id: 'momo', label: 'MTN / Telecel Mobile Money', detail: `${gateway === 'paystack' ? 'Paystack Ghana' : 'Flutterwave'} MoMo prompt` },
      { id: 'card', label: 'Bank Card', detail: 'Visa & Mastercard (GHS)' },
      { id: 'bank', label: 'Local Bank Account', detail: 'Instant Ghanaian bank authorization' },
    ];
  }
  if (country === 'Kenya') {
    return [
      { id: 'mpesa', label: 'M-Pesa STK Push', detail: 'Safaricom mobile money checkout' },
      { id: 'card', label: 'Visa / Mastercard', detail: 'KES card processing' },
      { id: 'bank', label: 'Kenyan Bank', detail: 'Direct bank settlement' },
    ];
  }
  if (country === 'South Africa') {
    return [
      { id: 'eft', label: 'Instant EFT / Bank', detail: 'Capitec, FNB, Nedbank, ABSA, Standard' },
      { id: 'card', label: 'Visa / Mastercard', detail: 'ZAR 3DS secured card' },
    ];
  }
  return [
    { id: 'visa', label: 'Visa Card', detail: 'Global USD debit or credit card' },
    { id: 'mastercard', label: 'Mastercard', detail: 'Global USD debit or credit card' },
    { id: 'amex', label: 'American Express', detail: 'International Amex card via Flutterwave' },
  ];
}

function AcceptedMethodIcons({ methodSet }: { methodSet: 'nigeria' | 'africa_multi' | 'international' }) {
  if (methodSet === 'nigeria') {
    return (
      <div className="flex flex-wrap items-center gap-3" aria-label="Accepted Nigerian payment methods">
        {/* OPay Icon */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-[#0B0F14]">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <rect width="24" height="24" rx="5" fill="#1DCF9F" />
            <circle cx="12" cy="12" r="5.5" fill="none" stroke="#08241C" strokeWidth="2.8" />
          </svg>
          <span className="text-xs font-semibold text-white tracking-tight">OPay</span>
        </div>

        {/* PalmPay Icon */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-[#0B0F14]">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <rect width="24" height="24" rx="5" fill="#6F42C1" />
            <path d="M8 17V7h5.2a3.3 3.3 0 0 1 0 6.6H10.5V17H8zm2.5-5.6h2.4a1.2 1.2 0 1 0 0-2.4h-2.4v2.4z" fill="#FFFFFF" />
          </svg>
          <span className="text-xs font-semibold text-white tracking-tight">PalmPay</span>
        </div>

        {/* Nigerian Bank Icon */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-[#0B0F14]">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <rect width="24" height="24" rx="5" fill="#1E293B" />
            <path d="M12 5L5 9h14l-7-4zm-5 6v5h2v-5H7zm4 0v5h2v-5h-2zm4 0v5h2v-5h-2zM5 18h14v1.5H5V18z" fill="#FBBF24" />
          </svg>
          <span className="text-xs font-semibold text-white tracking-tight">Bank / USSD / Card</span>
        </div>
      </div>
    );
  }

  if (methodSet === 'africa_multi') {
    return (
      <div className="flex flex-wrap items-center gap-3" aria-label="Accepted African and card payment methods">
        {/* Mobile Money */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-[#0B0F14]">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white tracking-tight">Mobile Money</span>
        </div>

        {/* Local Bank */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-[#0B0F14]">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4L4 8.5h16L12 4zm-6 6v6h2v-6H6zm5 0v6h2v-6h-2zm5 0v6h2v-6h-2zM4 18h16v2H4v-2z" fill="#FBBF24" />
          </svg>
          <span className="text-xs font-semibold text-white tracking-tight">Bank Transfer</span>
        </div>

        {/* Visa */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-[#0B0F14]">
          <svg width="26" height="16" viewBox="0 0 38 22" aria-hidden="true">
            <rect width="38" height="22" rx="3" fill="#1A1F71" />
            <text x="19" y="15" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="800" fontFamily="sans-serif">
              VISA
            </text>
          </svg>
          <span className="text-xs font-semibold text-white tracking-tight">Visa</span>
        </div>

        {/* Mastercard */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-[#0B0F14]">
          <svg width="26" height="16" viewBox="0 0 38 22" aria-hidden="true">
            <rect width="38" height="22" rx="3" fill="#0F172A" />
            <circle cx="15" cy="11" r="6" fill="#EB001B" />
            <circle cx="23" cy="11" r="6" fill="#F79E1B" fillOpacity="0.88" />
          </svg>
          <span className="text-xs font-semibold text-white tracking-tight">Mastercard</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3" aria-label="Accepted international payment methods">
      {/* Visa */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-[#0B0F14]">
        <svg width="28" height="18" viewBox="0 0 40 24" aria-hidden="true">
          <rect width="40" height="24" rx="3" fill="#1A1F71" />
          <text x="20" y="16" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="800" fontFamily="sans-serif">
            VISA
          </text>
        </svg>
        <span className="text-xs font-semibold text-white tracking-tight">Visa</span>
      </div>

      {/* Mastercard */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-[#0B0F14]">
        <svg width="28" height="18" viewBox="0 0 40 24" aria-hidden="true">
          <rect width="40" height="24" rx="3" fill="#0F172A" />
          <circle cx="16" cy="12" r="6.5" fill="#EB001B" />
          <circle cx="24" cy="12" r="6.5" fill="#F79E1B" fillOpacity="0.9" />
        </svg>
        <span className="text-xs font-semibold text-white tracking-tight">Mastercard</span>
      </div>

      {/* PayPal */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-[#0B0F14]">
        <svg width="22" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <rect width="24" height="24" rx="4" fill="#003087" />
          <path d="M9.5 18H7l1.8-11h4.6c2.2 0 3.6 1.1 3.2 3.3-.4 2.4-2.1 3.6-4.4 3.6H10l-.5 4.1z" fill="#FFFFFF" />
          <path d="M12.2 18h-2l1.2-7.5h3.5c1.7 0 2.7.8 2.4 2.5-.3 1.9-1.6 2.8-3.5 2.8h-1.2l-.4 2.2z" fill="#009CDE" />
        </svg>
        <span className="text-xs font-semibold text-white tracking-tight">PayPal</span>
      </div>

      {/* Amex */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-[#0B0F14]">
        <svg width="28" height="18" viewBox="0 0 40 24" aria-hidden="true">
          <rect width="40" height="24" rx="3" fill="#2E77BC" />
          <text x="20" y="15.5" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="800" fontFamily="sans-serif">
            AMEX
          </text>
        </svg>
        <span className="text-xs font-semibold text-white tracking-tight">Amex</span>
      </div>
    </div>
  );
}

export function CoinShop({ profile, onSignIn, onCoinsCredited }: CoinShopProps) {
  const [country, setCountry] = useState<ShopCountry>(() => {
    try {
      const saved = localStorage.getItem('shop_country') as ShopCountry | null;
      if (saved && SHOP_COUNTRIES[saved]) return saved;
    } catch {
      // Ignore storage restrictions
    }
    return 'Nigeria';
  });

  const [localCoins, setLocalCoins] = useState<number>(() => readLocalCoinBalance(profile?.uid));
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [sandboxModal, setSandboxModal] = useState<SandboxCheckoutState | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (typeof profile?.coinBalance === 'number') {
      setLocalCoins(profile.coinBalance);
      writeLocalCoinBalance(profile.coinBalance, profile.uid);
    } else {
      setLocalCoins(readLocalCoinBalance(profile?.uid));
    }
  }, [profile?.coinBalance, profile?.uid]);

  const handleCountryChange = (next: ShopCountry) => {
    setCountry(next);
    setFeedback(null);
    try {
      localStorage.setItem('shop_country', next);
    } catch {
      // Ignore storage restrictions
    }
  };

  const countryConfig = SHOP_COUNTRIES[country];
  const displayedCoinBalance = Math.max(profile?.coinBalance ?? 0, localCoins);

  const finalizePurchase = async (params: {
    gateway: ShopGateway;
    pkg: ShopPackage;
    reference: string;
    transactionId?: string;
    mode: 'live' | 'sandbox';
    channelNote?: string;
  }) => {
    if (!profile) {
      throw new Error('Sign in with Google first to credit coins to your driver account.');
    }

    await verifyShopPaymentOnServer({
      gateway: params.gateway,
      reference: params.reference,
      transactionId: params.transactionId,
      country: countryConfig.country,
      coins: params.pkg.coins,
      mode: params.mode,
    });

    const gatewayName = params.gateway === 'paystack' ? 'Paystack' : 'Flutterwave';
    const gatewayLabel = params.channelNote
      ? `${gatewayName} (${params.channelNote} · ${countryConfig.country})`
      : `${gatewayName} (${countryConfig.country})`;

    const nextBalance = await creditShopCoins({
      uid: profile.uid,
      coins: params.pkg.coins,
      gatewayLabel,
      priceLabel: params.pkg.formattedPrice,
      referenceId: params.reference,
    });

    setLocalCoins(nextBalance);
    writeLocalCoinBalance(nextBalance, profile.uid);
    setFeedback({
      kind: 'success',
      text: `+${params.pkg.coins.toLocaleString()} non-redeemable coins credited via ${gatewayLabel}. New Coin Balance: ${nextBalance.toLocaleString()} coins.`,
    });
    onCoinsCredited?.(params.pkg.coins, nextBalance, params.pkg.formattedPrice, gatewayLabel);
  };

  const handleStartCheckout = async (pkg: ShopPackage, gateway: ShopGateway) => {
    setFeedback(null);
    if (!profile) {
      onSignIn();
      return;
    }

    const opKey = `${pkg.coins}_${gateway}`;
    const reference = createShopReference(gateway, countryConfig.country, pkg.coins);
    setProcessingKey(opKey);

    try {
      const outcome =
        gateway === 'paystack'
          ? await launchPaystackInline({
              email: profile.email,
              countryConfig,
              pkg,
              reference,
            })
          : await launchFlutterwaveInline({
              email: profile.email,
              displayName: profile.displayName,
              countryConfig,
              pkg,
              reference,
            });

      if (outcome.status === 'no_public_key') {
        const defaultChannels = getSandboxChannels(countryConfig.country, gateway);
        setSandboxModal({
          gateway,
          pkg,
          reference,
          selectedChannel: defaultChannels[0]?.label || gateway,
        });
        setProcessingKey(null);
        return;
      }

      if (outcome.status === 'cancelled') {
        setProcessingKey(null);
        return;
      }

      await finalizePurchase({
        gateway,
        pkg,
        reference: outcome.reference,
        transactionId: outcome.transactionId,
        mode: 'live',
      });
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Unable to complete coin purchase.',
      });
    } finally {
      setProcessingKey(null);
    }
  };

  const handleConfirmSandboxCheckout = async () => {
    if (!sandboxModal) return;
    const { gateway, pkg, reference, selectedChannel } = sandboxModal;
    const opKey = `${pkg.coins}_${gateway}`;
    setProcessingKey(opKey);
    try {
      await finalizePurchase({
        gateway,
        pkg,
        reference,
        mode: 'sandbox',
        channelNote: selectedChannel,
      });
      setSandboxModal(null);
    } catch (err) {
      setFeedback({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Sandbox payment verification failed.',
      });
    } finally {
      setProcessingKey(null);
    }
  };

  return (
    <section className="space-y-8">
      {/* Top Shop Header + Country Selector + Non-Redeemable Balance */}
      <div className="rounded-2xl border border-white/10 bg-[#111722] p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
            <Coins className="w-4 h-4" />
            <span>Gridline Coin Shop · Non-Redeemable</span>
          </div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">
            Top Up Driver Coins
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Gridline is 100% free to race. Buy virtual Coins in your local currency for Nigeria, Ghana, Kenya,
            South Africa, or International cards — Coins are strictly non-withdrawable (no cashout).
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 shrink-0">
          {/* Country Selector Dropdown at Top of Shop */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-slate-400 inline-flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              Country / Region
            </span>
            <select
              aria-label="Shop country selector"
              value={country}
              onChange={(e) => handleCountryChange(e.target.value as ShopCountry)}
              className="px-3.5 py-2.5 rounded-lg bg-[#0B0F14] border border-white/15 text-sm font-medium text-white focus:outline-none focus:border-amber-500 min-w-[190px]"
            >
              {SHOP_COUNTRY_LIST.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {/* Non-Redeemable Coin Balance Display */}
          <div className="rounded-xl border border-amber-500/25 bg-[#0B0F14] px-4 py-2.5 min-w-[200px]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">Coin Balance</span>
              <span className="text-[11px] font-mono text-amber-400 inline-flex items-center gap-1">
                <Lock className="w-3 h-3" />
                No Cashout
              </span>
            </div>
            <p className="font-mono text-2xl font-bold text-white tabular-nums mt-0.5">
              {displayedCoinBalance.toLocaleString()}{' '}
              <span className="text-xs font-normal text-amber-400">Coins</span>
            </p>
          </div>
        </div>
      </div>

      {/* Sign-In Prompt if Visitor is Not Logged In */}
      {!profile && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Sign in to bind coin purchases to your driver profile</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Purchases sync to your verified cloud profile and local storage automatically.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignIn}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Sign In with Google
          </button>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs flex items-center justify-between gap-4 ${
            feedback.kind === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            {feedback.kind === 'success' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
            {feedback.text}
          </span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Accepted Payment Icons Bar */}
      <div className="rounded-xl border border-white/10 bg-[#111722] px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-white">
            Accepted Payment Channels · {countryConfig.country} ({countryConfig.currency})
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{countryConfig.channelSummary}</p>
        </div>
        <AcceptedMethodIcons methodSet={countryConfig.acceptedMethodSet} />
      </div>

      {/* 3 Coin Package Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {countryConfig.packages.map((pkg) => {
          const isFeatured = pkg.coins === 5000;
          const isBestValue = pkg.coins === 12000;

          return (
            <div
              key={pkg.coins}
              className={`rounded-2xl border p-6 flex flex-col justify-between gap-6 transition-colors ${
                isBestValue
                  ? 'border-amber-500/45 bg-[#131A27]'
                  : isFeatured
                  ? 'border-emerald-500/35 bg-[#111722]'
                  : 'border-white/10 bg-[#111722]'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-400">{pkg.title}</p>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="font-mono text-3xl font-bold text-white tabular-nums">
                        {pkg.coins.toLocaleString()}
                      </span>
                      <span className="text-xs font-semibold text-amber-400">Coins</span>
                    </div>
                  </div>
                  {pkg.bonusNote && (
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap ${
                        isBestValue
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                          : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                      }`}
                    >
                      {pkg.bonusNote}
                    </span>
                  )}
                </div>

                <div className="pt-4 border-t border-white/8 flex items-baseline justify-between">
                  <span className="text-xs text-slate-400">{countryConfig.currencyLabel}</span>
                  <span className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                    {pkg.formattedPrice}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500">
                  Instant credit · Non-redeemable (no cashout)
                </p>
              </div>

              {/* Dynamic Gateway Buttons Based on Country Logic */}
              <div className="space-y-2.5">
                {countryConfig.gateways.includes('paystack') && (
                  <button
                    type="button"
                    disabled={processingKey !== null}
                    onClick={() => handleStartCheckout(pkg, 'paystack')}
                    className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <CreditCard className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {processingKey === `${pkg.coins}_paystack`
                        ? 'Processing Paystack...'
                        : country === 'Nigeria'
                        ? `Pay ${pkg.formattedPrice} with Paystack`
                        : `Paystack (${pkg.formattedPrice})`}
                    </span>
                  </button>
                )}

                {countryConfig.gateways.includes('flutterwave') && (
                  <button
                    type="button"
                    disabled={processingKey !== null}
                    onClick={() => handleStartCheckout(pkg, 'flutterwave')}
                    className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <CreditCard className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {processingKey === `${pkg.coins}_flutterwave`
                        ? 'Processing Flutterwave...'
                        : countryConfig.gateways.length === 1
                        ? `Pay ${pkg.formattedPrice} with Flutterwave`
                        : `Flutterwave (${pkg.formattedPrice})`}
                    </span>
                  </button>
                )}

                {country === 'Nigeria' && (
                  <p className="text-[11px] text-center text-slate-400">
                    Channels: OPay · PalmPay · Bank Transfer · USSD · Card
                  </p>
                )}
                {(country === 'USA' || country === 'UK' || country === 'Other') && (
                  <p className="text-[11px] text-center text-slate-400">
                    Accepts Visa · Mastercard · American Express
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Non-Redeemable Policy Footer */}
      <div className="rounded-xl border border-white/8 bg-[#111722]/70 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
        <div className="inline-flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Shop Coins are strictly non-withdrawable virtual game credits and can never be cashed out or converted
            into real currency.
          </span>
        </div>
        <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
          Synced: Cloud Profile + LocalStorage
        </span>
      </div>

      {/* Interactive Gateway Sandbox Checkout Modal (when live VITE_*_PUBLIC_KEY is not set) */}
      {sandboxModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => (processingKey ? null : setSandboxModal(null))}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/12 bg-[#111722] p-6 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-semibold text-emerald-400">
                  {sandboxModal.gateway === 'paystack' ? 'Paystack Checkout' : 'Flutterwave Checkout'} ·{' '}
                  {countryConfig.country}
                </p>
                <h2 className="font-display text-xl font-bold text-white mt-0.5">
                  {sandboxModal.pkg.coins.toLocaleString()} Coins — {sandboxModal.pkg.formattedPrice}
                </h2>
              </div>
              <button
                type="button"
                disabled={processingKey !== null}
                onClick={() => setSandboxModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                aria-label="Close checkout"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-medium text-slate-300">
                Select {sandboxModal.gateway === 'paystack' ? 'Paystack' : 'Flutterwave'} channel:
              </p>
              <div className="space-y-2">
                {getSandboxChannels(countryConfig.country, sandboxModal.gateway).map((ch) => {
                  const active = sandboxModal.selectedChannel === ch.label;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSandboxModal((prev) => (prev ? { ...prev, selectedChannel: ch.label } : prev))}
                      className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-colors flex items-center justify-between gap-3 ${
                        active
                          ? 'border-amber-500 bg-amber-500/10 text-white'
                          : 'border-white/10 bg-[#0B0F14] text-slate-300 hover:border-white/25'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-semibold">{ch.label}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{ch.detail}</p>
                      </div>
                      {active && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-white/8 bg-[#0B0F14] px-3.5 py-2.5 text-[11px] text-slate-400 flex items-center justify-between gap-2">
              <span>Ref: {sandboxModal.reference}</span>
              <span className="text-amber-400 font-mono">Non-Redeemable</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                disabled={processingKey !== null}
                onClick={() => setSandboxModal(null)}
                className="px-4 py-2 rounded-lg bg-white/8 hover:bg-white/15 text-xs font-semibold text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingKey !== null}
                onClick={handleConfirmSandboxCheckout}
                className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                {processingKey ? 'Verifying Payment...' : `Complete ${sandboxModal.pkg.formattedPrice} Payment`}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
