"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  Clock,
  Coffee,
  Copy,
  Dumbbell,
  Gift,
  Loader2,
  QrCode,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import { useFirebaseAuth } from "@/components/providers/FirebaseAuthProvider";
import {
  fetchMyRewardRedemptions,
  redeemCivicReward,
} from "@/lib/firebase-users";
import {
  canRedeemReward,
  formatCountdownSeconds,
  generateUniqueCouponCode,
  getCivicLevelBadge,
  REWARD_CATALOG,
  REWARD_VOUCHER_DURATION_SECONDS,
} from "@/lib/civic-logic";
import { generateQrMatrix } from "@/lib/bengaluru-feed-data";
import { CivicBadgeChip } from "@/components/ui/CivicBadgeChip";
import { HoverCard, PageTransition } from "@/components/ui/MotionPrimitives";
import type { RewardItem, RewardRedemptionRecord } from "@/types/civic";

const REWARD_ICONS = {
  "gym-15-off": Dumbbell,
  "cafe-free-coffee": Coffee,
  "grocery-10-off": ShoppingBasket,
} as const;

const DEFAULT_DEMO_WALLET_POINTS = 750;

export function RewardsStoreWorkspace() {
  const { user, profile, displayAlias, authReady, refreshProfile } =
    useFirebaseAuth();

  const [demoBalance, setDemoBalance] = useState(DEFAULT_DEMO_WALLET_POINTS);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeVoucher, setActiveVoucher] =
    useState<RewardRedemptionRecord | null>(null);
  const [history, setHistory] = useState<RewardRedemptionRecord[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [copiedCode, setCopiedCode] = useState(false);

  // Load signed-in user's Firestore redemptions
  useEffect(() => {
    if (!authReady || !user) {
      return;
    }

    let cancelled = false;
    void refreshProfile();
    fetchMyRewardRedemptions(user.uid)
      .then((items) => {
        if (!cancelled) {
          setHistory(items);
        }
      })
      .catch(() => {
        // Non-blocking
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, user, refreshProfile]);

  // 1-second live countdown tick while fraud-prevention modal is open
  useEffect(() => {
    if (!activeVoucher) return;
    setNowMs(Date.now());
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeVoucher]);

  // Close modal on Escape
  useEffect(() => {
    if (!activeVoucher) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveVoucher(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeVoucher]);

  const isLiveSignedIn = Boolean(user);
  const civicPoints = isLiveSignedIn ? (profile?.civicPoints ?? 0) : demoBalance;
  const levelBadge = getCivicLevelBadge(civicPoints);

  const handleRedeem = async (reward: RewardItem) => {
    setError(null);
    setCopiedCode(false);

    if (user) {
      setRedeemingId(reward.id);
      try {
        const { redemption } = await redeemCivicReward(user, reward);
        setActiveVoucher(redemption);
        setHistory((prev) => [redemption, ...prev]);
        await refreshProfile();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not complete reward redemption right now."
        );
      } finally {
        setRedeemingId(null);
      }
      return;
    }

    // Interactive Bengaluru Demo Wallet redemption (750 pts -> deducts cleanly & opens 15-min QR modal)
    const check = canRedeemReward(demoBalance, reward);
    if (!check.eligible) {
      setError(`You need ${check.shortfall} more CivicPoints for this voucher.`);
      return;
    }

    const now = Date.now();
    const demoVoucher: RewardRedemptionRecord = {
      id: `DEMO-${now}`,
      userId: "demo-citizen",
      rewardId: reward.id,
      rewardTitle: reward.title,
      pointsSpent: reward.pointsCost,
      terms: reward.terms,
      couponCode: generateUniqueCouponCode(reward.codePrefix),
      createdAtIso: new Date(now).toISOString(),
      expiresAtMs: now + REWARD_VOUCHER_DURATION_SECONDS * 1000,
      isDemoPreview: true,
    };

    setDemoBalance((prev) => Math.max(0, prev - reward.pointsCost));
    setActiveVoucher(demoVoucher);
    setHistory((prev) => [demoVoucher, ...prev]);
  };

  const handleCopyCoupon = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Clipboard blocked in restricted frames
    }
  };

  const remainingSeconds = activeVoucher
    ? Math.max(0, Math.ceil((activeVoucher.expiresAtMs - nowMs) / 1000))
    : 0;
  const isVoucherExpired = Boolean(activeVoucher && remainingSeconds <= 0);

  const qrMatrix = useMemo(
    () => (activeVoucher ? generateQrMatrix(activeVoucher.couponCode) : []),
    [activeVoucher]
  );

  return (
    <PageTransition className="mt-7 space-y-8">
      {/* Citizen Wallet Card */}
      <section
        aria-label="Citizen CivicPoints wallet"
        className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-blue-600">
              {isLiveSignedIn
                ? `Citizen Wallet · ${displayAlias || user?.email}`
                : "Citizen Wallet · Demo Balance"}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-baseline gap-2.5">
                <span
                  data-testid="wallet-balance"
                  className="font-[var(--font-heading)] text-4xl font-extrabold tabular-nums text-slate-900"
                >
                  {civicPoints}
                </span>
                <span className="text-base font-semibold text-slate-700">
                  CivicPoints Available
                </span>
              </div>
              <CivicBadgeChip badge={levelBadge} size="sm" />
            </div>
            <p className="text-xs text-slate-500">
              No cash value · Merchant redeemable at verified Bengaluru partner
              outlets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/report"
              className="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 whitespace-nowrap"
            >
              Earn +50 CivicPoints
            </Link>
            {isLiveSignedIn ? (
              <Link
                href="/profile"
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 whitespace-nowrap"
              >
                My Profile
              </Link>
            ) : (
              <Link
                href="/login?next=%2Frewards"
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 whitespace-nowrap"
              >
                Sign In to Sync Wallet
              </Link>
            )}
          </div>
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
        >
          {error}
        </p>
      )}

      {/* Partner Voucher Cards */}
      <section aria-label="Bengaluru partner vouchers">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Bengaluru Partner Vouchers
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Tap Redeem to launch a fraud-protected 15-minute QR verification
              voucher.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <ShieldCheck size={15} aria-hidden="true" />
            <span>Anti-screenshot 15-min live timer</span>
          </span>
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-3">
          {REWARD_CATALOG.map((reward) => {
            const Icon = REWARD_ICONS[reward.id];
            const eligibility = canRedeemReward(civicPoints, reward);
            const isWorking = redeemingId === reward.id;

            return (
              <HoverCard
                key={reward.id}
                className="flex flex-col justify-between p-6"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Icon size={21} aria-hidden="true" />
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-mono text-xs font-bold tabular-nums text-blue-700">
                      <Sparkles size={12} aria-hidden="true" />
                      <span>{reward.pointsCost} Pts</span>
                    </span>
                  </div>

                  <p className="mt-4 text-xs font-semibold text-slate-500">
                    {reward.merchantCategory}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">
                    {reward.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {reward.description}
                  </p>

                  <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">Terms:</span>{" "}
                    {reward.terms} · Valid {reward.validityMinutes} mins after
                    redemption
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    disabled={!eligibility.eligible || Boolean(redeemingId)}
                    onClick={() => void handleRedeem(reward)}
                    className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
                  >
                    {isWorking ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Gift size={16} aria-hidden="true" />
                    )}
                    <span>
                      {isWorking
                        ? "Generating Voucher..."
                        : eligibility.eligible
                          ? `Redeem (${reward.pointsCost} Pts)`
                          : `Need ${eligibility.shortfall} More Pts`}
                    </span>
                  </button>
                </div>
              </HoverCard>
            );
          })}
        </div>
      </section>

      {/* Redeemed History */}
      {history.length > 0 && (
        <section
          aria-label="Your redeemed vouchers"
          className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm"
        >
          <h2 className="text-base font-bold text-slate-900">
            Recent Vouchers ({history.length})
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Re-open any active voucher to display the live merchant QR code and
            countdown timer.
          </p>

          <ul className="mt-4 divide-y divide-slate-100">
            {history.map((item) => {
              const stillActive = item.expiresAtMs > Date.now();
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.rewardTitle}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Code:{" "}
                      <span className="font-mono font-semibold text-slate-800">
                        {item.couponCode}
                      </span>{" "}
                      · {item.terms} · -{item.pointsSpent} Pts
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveVoucher(item)}
                    className={`inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-colors ${
                      stillActive
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Ticket size={13} aria-hidden="true" />
                    <span>{stillActive ? "Show QR & Timer" : "View Code"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Fraud-Prevention 15-Minute Countdown & QR Verification Modal */}
      <AnimatePresence>
        {activeVoucher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              key="voucher-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveVoucher(null)}
              aria-hidden="true"
              className="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px]"
            />

            <motion.div
              key="voucher-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="voucher-modal-title"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              {/* Modal Top Bar */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <ShieldCheck size={12} aria-hidden="true" />
                    <span>Fraud-Protected Merchant Voucher</span>
                  </span>
                  <h2
                    id="voucher-modal-title"
                    className="mt-2 text-lg font-bold text-slate-900"
                  >
                    {activeVoucher.rewardTitle}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveVoucher(null)}
                  aria-label="Close voucher modal"
                  className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-5 p-5">
                {/* Live 15-Minute Timer Banner */}
                <div
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                    isVoucherExpired
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <Clock size={15} aria-hidden="true" />
                    <span>
                      {isVoucherExpired
                        ? "Verification window expired"
                        : "Live merchant verification timer"}
                    </span>
                  </div>
                  <span
                    data-testid="voucher-countdown"
                    className="font-mono text-2xl font-extrabold tabular-nums"
                  >
                    {formatCountdownSeconds(remainingSeconds)}
                  </span>
                </div>

                {/* Scannable QR Code Matrix */}
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-5">
                  <div
                    aria-label={`Merchant verification QR code for ${activeVoucher.couponCode}`}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs"
                  >
                    <div className="grid grid-cols-9 gap-1">
                      {qrMatrix.flatMap((row, rIdx) =>
                        row.map((filled, cIdx) => (
                          <span
                            key={`${rIdx}-${cIdx}`}
                            className={`h-3.5 w-3.5 rounded-[2px] ${
                              filled ? "bg-slate-900" : "bg-transparent"
                            }`}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                    <QrCode size={13} aria-hidden="true" />
                    <span>Show QR &amp; code at counter before timer hits 00:00</span>
                  </p>

                  {/* Coupon Code + Copy */}
                  <div className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                    <span
                      data-testid="active-coupon-code"
                      className="font-mono text-base font-bold tracking-wider text-slate-900"
                    >
                      {activeVoucher.couponCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopyCoupon(activeVoucher.couponCode)}
                      className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      {copiedCode ? (
                        <>
                          <Check
                            size={13}
                            className="text-emerald-600"
                            aria-hidden="true"
                          />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} aria-hidden="true" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Terms: {activeVoucher.terms}</span>
                  <span className="font-mono font-semibold text-blue-700">
                    -{activeVoucher.pointsSpent} CivicPoints
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
