import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { getMySubscription, updateMySubscription } from "@/src/api/subscription";
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
import type { SubscriptionPlansResponse } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

type BillingPeriod = "monthly" | "yearly";
type PlanId = "free" | "pro" | "premium";

const DEFAULT_CURRENT: SubscriptionPlansResponse["current"] = {
  planId: "free",
  status: "none",
  billingPeriod: "monthly",
  startedAt: null,
  expiresAt: null,
  isPremium: false,
  isFeatured: false,
};

/** Match web premium pricing: yearly = 10× monthly (2 months free). */
function displayPrice(monthlyPrice: number, period: BillingPeriod): number {
  if (period === "yearly") return Math.round(monthlyPrice * 10);
  return monthlyPrice;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

export default function SubscriptionScreen() {
  const [data, setData] = useState<SubscriptionPlansResponse | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [loading, setLoading] = useState(true);
  const [actingPlanId, setActingPlanId] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    logger.debug("subscription", "load");
    try {
      const next = normalizeSubscriptionResponse(await getMySubscription());
      setData(next);
      setPeriod(next.current.billingPeriod || "monthly");
      logger.info("subscription", "loaded", {
        planId: next.current.planId,
        status: next.current.status,
        billingPeriod: next.current.billingPeriod,
        expiresAt: next.current.expiresAt,
        isPremium: next.current.isPremium,
        isFeatured: next.current.isFeatured,
        planCount: next.plans.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plans");
      logger.error("subscription", "load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const choose = async (planId: PlanId) => {
    setActingPlanId(planId);
    setError(null);
    setOk(null);
    logger.info("subscription", "select plan", { planId, billingPeriod: period });
    try {
      const result = await updateMySubscription({ planId, billingPeriod: period });
      const subscription = result?.subscription ?? DEFAULT_CURRENT;
      setOk(`Switched to ${planId} (${period})`);
      logger.info("subscription", "updated", {
        planId: subscription.planId,
        billingPeriod: subscription.billingPeriod,
        expiresAt: subscription.expiresAt,
        isPremium: subscription.isPremium,
        isFeatured: subscription.isFeatured,
      });
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
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
          {(current.planId || "free").toUpperCase()} · {current.status || "none"}
        </Text>
        <Muted>
          Billing: {current.billingPeriod || "monthly"}
          {current.isPremium ? " · Premium" : ""}
          {current.isFeatured ? " · Featured" : ""}
        </Muted>
        <Muted>Started: {formatDate(current.startedAt)}</Muted>
        <Muted>
          {current.expiresAt
            ? `Renews / expires: ${formatDate(current.expiresAt)}`
            : "No renewal date (free or open-ended)"}
        </Muted>
      </Card>

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
          const price = displayPrice(plan.price, period);
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
                ${price}
                <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: "500" }}>
                  /{period === "yearly" ? "year" : "mo"}
                </Text>
              </Text>
              {period === "yearly" && plan.price > 0 ? (
                <Muted>
                  ${plan.price}/mo billed yearly (${price} total)
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
    </Screen>
  );
}
