import { formatMoney } from '@/src/utils/format';
import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { getMySubscription, getMySubscriptionPayments, updateMySubscription } from "@/src/api/subscription";
import { createSubscriptionCheckoutSession } from "@/src/api/payments";
import { getMyProvider } from "@/src/api/providers";
import { PlanBadge } from "@/src/components/PlanBadge";
import { DowngradeVisibilityModal } from "@/src/components/DowngradeVisibilityModal";
import { SubscriptionPaymentCard } from "@/src/components/SubscriptionPaymentCard";
import {
  Button,
  Card,
  Chip,
  ErrorState,
  LoadingState,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import type {
  PortfolioItem,
  ProviderService,
  SubscriptionPayment,
  SubscriptionPlansResponse,
} from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";
import { formatSubscriptionDate, planNameForPayment } from "@/src/utils/subscriptionDisplay";

type BillingPeriod = "monthly" | "yearly";
type PlanId = "free" | "pro" | "premium";

const FREE_MAX_PORTFOLIO = 3;
const FREE_MAX_SERVICES = 3;

const DEFAULT_CURRENT: SubscriptionPlansResponse["current"] = {
  planId: "free",
  status: "none",
  billingPeriod: "monthly",
  startedAt: null,
  expiresAt: null,
  isPremium: false,
  isFeatured: false,
};

/** Use plan yearlyPrice from API when available; fallback to 10× monthly. */
function displayPrice(
  plan: { price: number; yearlyPrice?: number },
  period: BillingPeriod,
): number {
  if (period === "yearly") {
    return plan.yearlyPrice ?? Math.round(plan.price * 10);
  }
  return plan.price;
}

function normalizeSubscriptionResponse(raw: unknown): SubscriptionPlansResponse {
  const obj =
    raw && typeof raw === "object" ? (raw as Partial<SubscriptionPlansResponse>) : {};
  const plans = Array.isArray(obj.plans) ? obj.plans : [];
  const current = {
    ...DEFAULT_CURRENT,
    ...(obj.current && typeof obj.current === "object" ? obj.current : {}),
  };
  if (!obj.current) {
    logger.warn("subscription", "API missing current; using free defaults", {
      planCount: plans.length,
      keys: Object.keys(obj),
    });
  }
  return { plans, current };
}

function subscriptionStatusFromUrl(url: string | null | undefined): "success" | "cancelled" | null {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    const value = parsed.queryParams?.subscription;
    const status = Array.isArray(value) ? value[0] : value;
    if (status === "success" || status === "cancelled") return status;
  } catch (e) {
    logger.warn("subscription", "failed to parse return url", { url, error: String(e) });
  }
  return null;
}

export default function SubscriptionScreen() {
  const params = useLocalSearchParams<{ subscription?: string | string[] }>();
  const subscriptionParam = Array.isArray(params.subscription)
    ? params.subscription[0]
    : params.subscription;
  const handledReturnRef = useRef<string | null>(null);

  const [data, setData] = useState<SubscriptionPlansResponse | null>(null);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [loading, setLoading] = useState(true);
  const [actingPlanId, setActingPlanId] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [downgradeConfirming, setDowngradeConfirming] = useState(false);
  const [downgradePortfolio, setDowngradePortfolio] = useState<PortfolioItem[]>([]);
  const [downgradeServices, setDowngradeServices] = useState<ProviderService[]>([]);

  const load = useCallback(async (): Promise<SubscriptionPlansResponse | null> => {
    setError(null);
    setPaymentsError(null);
    logger.debug("subscription", "load");
    try {
      const [subscriptionRaw, paymentRows] = await Promise.all([
        getMySubscription(),
        getMySubscriptionPayments().catch((paymentErr) => {
          const message =
            paymentErr instanceof Error ? paymentErr.message : "Failed to load billing history";
          setPaymentsError(message);
          logger.error("subscription", "payments load failed", paymentErr);
          return [] as SubscriptionPayment[];
        }),
      ]);
      const next = normalizeSubscriptionResponse(subscriptionRaw);
      setData(next);
      setPayments(paymentRows);
      setPeriod(next.current.billingPeriod || "monthly");
      logger.info("subscription", "loaded", {
        planId: next.current.planId,
        status: next.current.status,
        billingPeriod: next.current.billingPeriod,
        expiresAt: next.current.expiresAt,
        isPremium: next.current.isPremium,
        isFeatured: next.current.isFeatured,
        planCount: next.plans.length,
        paymentCount: paymentRows.length,
      });
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plans");
      logger.error("subscription", "load failed", e);
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const pollAfterPayment = useCallback(async () => {
    setOk("Payment received — updating your plan…");
    logger.info("subscription", "checkout success — polling plan");
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      const next = await load();
      if (next && next.current.planId !== "free" && next.current.status === "active") {
        const planLabel = planNameForPayment(
          next.current.planId as SubscriptionPayment["planId"],
        );
        setOk(`You're now on the ${planLabel} plan.`);
        logger.info("subscription", "poll complete — plan active", {
          attempt,
          planId: next.current.planId,
          status: next.current.status,
        });
        return;
      }
      logger.debug("subscription", "poll waiting for webhook", { attempt });
      if (attempt < 8) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    setOk("Payment received. Your plan may take a moment to update — pull to refresh.");
    logger.info("subscription", "poll ended without active paid plan");
  }, [load]);

  const handleCheckoutReturn = useCallback(
    async (status: "success" | "cancelled", source: string) => {
      if (handledReturnRef.current === status) {
        logger.debug("subscription", "skip duplicate checkout return", { status, source });
        return;
      }
      handledReturnRef.current = status;
      logger.info("subscription", "checkout return", { status, source });
      if (status === "cancelled") {
        setOk(null);
        setError("Checkout cancelled. You can try again anytime.");
        await load();
        return;
      }
      setError(null);
      await pollAfterPayment();
    },
    [load, pollAfterPayment],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (subscriptionParam === "success" || subscriptionParam === "cancelled") {
      void handleCheckoutReturn(subscriptionParam, "deep-link");
    }
  }, [subscriptionParam, handleCheckoutReturn]);

  const choose = async (planId: PlanId) => {
    setActingPlanId(planId);
    setError(null);
    setOk(null);
    logger.info("subscription", "select plan", { planId, billingPeriod: period });
    try {
      if (planId === "free") {
        const me = await getMyProvider();
        const portfolio = me.portfolio ?? [];
        const services = me.services ?? [];
        const overLimit =
          portfolio.length > FREE_MAX_PORTFOLIO || services.length > FREE_MAX_SERVICES;
        if (overLimit) {
          logger.info("subscription", "open downgrade picker", {
            portfolio: portfolio.length,
            services: services.length,
          });
          setDowngradePortfolio(portfolio);
          setDowngradeServices(services);
          setDowngradeOpen(true);
          setActingPlanId(null);
          return;
        }
        const result = await updateMySubscription({ planId, billingPeriod: period });
        const subscription = result?.subscription ?? DEFAULT_CURRENT;
        setOk("Switched to free");
        logger.info("subscription", "updated", {
          planId: subscription.planId,
          billingPeriod: subscription.billingPeriod,
          expiresAt: subscription.expiresAt,
          isPremium: subscription.isPremium,
          isFeatured: subscription.isFeatured,
        });
        await load();
        return;
      }

      const session = await createSubscriptionCheckoutSession({
        planId,
        billingPeriod: period,
        client: "mobile",
      });
      // Reset so a fresh checkout return can be handled again.
      handledReturnRef.current = null;
      const redirectUrl = Linking.createURL("subscription");
      logger.info("subscription", "checkout session created", {
        planId,
        checkoutSessionId: session.checkoutSessionId,
        client: "mobile",
        redirectUrl,
      });

      const result = await WebBrowser.openAuthSessionAsync(session.checkoutUrl, redirectUrl);
      logger.info("subscription", "auth session result", {
        type: result.type,
        url: result.type === "success" ? result.url : undefined,
      });

      if (result.type === "success") {
        const status = subscriptionStatusFromUrl(result.url) ?? "success";
        await handleCheckoutReturn(status, "auth-session");
        return;
      }

      // User dismissed the browser without a deep-link return — refresh once.
      logger.info("subscription", "auth session dismissed — single refresh");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      logger.error("subscription", "update failed", e);
    } finally {
      setActingPlanId(null);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <ErrorState message="No plans" />;

  const current = data.current ?? DEFAULT_CURRENT;
  const plans = Array.isArray(data.plans) ? data.plans : [];
  const paymentPreview = payments.slice(0, 3);

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <Title>Your plan</Title>
      <Card>
        <PlanBadge
          planId={current.planId || "free"}
          status={current.status || "none"}
        />
        <Muted>
          Billing: {current.billingPeriod || "monthly"}
          {current.isFeatured ? " · Featured listing" : ""}
        </Muted>
        <Muted>Started: {formatSubscriptionDate(current.startedAt)}</Muted>
        <Muted>
          {current.expiresAt
            ? `Renews / expires: ${formatSubscriptionDate(current.expiresAt)}`
            : "No renewal date (free or open-ended)"}
        </Muted>
      </Card>

      <Title>Billing history</Title>
      {paymentsError ? (
        <Text style={{ color: colors.danger }}>{paymentsError}</Text>
      ) : null}
      {paymentPreview.length === 0 && !paymentsError ? (
        <Card>
          <Muted>No subscription payments yet.</Muted>
        </Card>
      ) : (
        paymentPreview.map((payment) => (
          <SubscriptionPaymentCard key={payment.id} payment={payment} />
        ))
      )}
      {payments.length > 0 ? (
        <Button
          label="View all billing history"
          variant="ghost"
          onPress={() => {
            logger.info("subscription", "open billing history");
            router.push("/(provider)/subscription-payments");
          }}
        />
      ) : null}

      <Muted>Billing period</Muted>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Chip
          label="Monthly"
          active={period === "monthly"}
          onPress={() => {
            setPeriod("monthly");
            logger.debug("subscription", "period toggle", { period: "monthly" });
          }}
        />
        <Chip
          label="Yearly · save ~17%"
          active={period === "yearly"}
          onPress={() => {
            setPeriod("yearly");
            logger.debug("subscription", "period toggle", { period: "yearly" });
          }}
        />
      </View>
      <Muted>
        Yearly prices are billed up front (10× monthly). Switch period, then select a plan.
      </Muted>

      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {ok ? <Text style={{ color: colors.success }}>{ok}</Text> : null}

      {plans.length === 0 ? (
        <Muted>No plans available from the server.</Muted>
      ) : (
        plans.map((plan) => {
          const price = displayPrice(plan, period);
          const isCurrent =
            current.planId === plan.id &&
            (plan.id === "free"
              ? true
              : current.status === "active" && current.billingPeriod === period);
          return (
            <Card key={`${plan.id}-${period}`}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
                {plan.name}
                {plan.isPopular ? " · Popular" : ""}
              </Text>
              <Text style={{ color: colors.accent, fontSize: 22, fontWeight: "800" }}>
                {formatMoney(price)}
                <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: "500" }}>
                  /{period === "yearly" ? "year" : "mo"}
                </Text>
              </Text>
              {period === "yearly" && plan.price > 0 ? (
                <Muted>
                  {formatMoney(plan.price)}/mo billed yearly ({formatMoney(price)} total)
                </Muted>
              ) : null}
              <Muted>{(plan.features ?? []).join(" · ")}</Muted>
              <Button
                label={isCurrent ? "Current plan" : `Select ${plan.name}`}
                variant={isCurrent ? "ghost" : plan.isPopular ? "primary" : "secondary"}
                disabled={isCurrent || actingPlanId != null}
                loading={actingPlanId === plan.id}
                onPress={() => choose(plan.id)}
              />
            </Card>
          );
        })
      )}

      <DowngradeVisibilityModal
        visible={downgradeOpen}
        maxPortfolio={FREE_MAX_PORTFOLIO}
        maxServices={FREE_MAX_SERVICES}
        portfolio={downgradePortfolio}
        services={downgradeServices}
        confirming={downgradeConfirming}
        onCancel={() => setDowngradeOpen(false)}
        onConfirm={(selection) => {
          void (async () => {
            setDowngradeConfirming(true);
            setError(null);
            try {
              const result = await updateMySubscription({
                planId: "free",
                billingPeriod: period,
                visiblePortfolioIds: selection.visiblePortfolioIds,
                visibleServiceIds: selection.visibleServiceIds,
              });
              const subscription = result?.subscription ?? DEFAULT_CURRENT;
              setOk("Switched to free");
              logger.info("subscription", "downgrade confirmed", {
                planId: subscription.planId,
                portfolio: selection.visiblePortfolioIds.length,
                services: selection.visibleServiceIds.length,
              });
              setDowngradeOpen(false);
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to switch plan");
              logger.error("subscription", "downgrade failed", e);
            } finally {
              setDowngradeConfirming(false);
            }
          })();
        }}
      />
    </Screen>
  );
}
