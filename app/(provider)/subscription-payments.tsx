import { formatMoney } from "@/src/utils/format";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { getMySubscriptionPayments } from "@/src/api/subscription";
import { SubscriptionPaymentCard } from "@/src/components/SubscriptionPaymentCard";
import {
  Card,
  Chip,
  EmptyState,
  ErrorState,
  LoadingState,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import type { SubscriptionPayment } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";
import { totalPaidAmount } from "@/src/utils/subscriptionDisplay";

type StatusFilter = "all" | SubscriptionPayment["status"];

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "completed", label: "Paid" },
  { id: "failed", label: "Failed" },
];

export default function SubscriptionPaymentsScreen() {
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    logger.debug("subscription-payments", "load");
    try {
      const rows = await getMySubscriptionPayments();
      setPayments(rows);
      logger.info("subscription-payments", "load ok", { count: rows.length });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load billing history";
      setError(message);
      logger.error("subscription-payments", "load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredPayments = useMemo(() => {
    if (statusFilter === "all") return payments;
    return payments.filter((p) => p.status === statusFilter);
  }, [payments, statusFilter]);

  const totalPaid = useMemo(() => totalPaidAmount(payments), [payments]);
  const completedCount = useMemo(
    () => payments.filter((p) => p.status === "completed").length,
    [payments],
  );

  if (loading) return <LoadingState />;
  if (error && payments.length === 0) {
    return <ErrorState message={error} onRetry={() => void load()} />;
  }

  return (
    <Screen
      scroll
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load();
      }}
    >
      <Title>Billing history</Title>
      <Muted>Subscription payments for your plan</Muted>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16 }}>
          <View>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 18 }}>
              {formatMoney(totalPaid)}
            </Text>
            <Muted>Total paid</Muted>
          </View>
          <View>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 18 }}>
              {payments.length}
            </Text>
            <Muted>Transactions</Muted>
          </View>
          <View>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 18 }}>
              {completedCount}
            </Text>
            <Muted>Completed</Muted>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {STATUS_FILTERS.map((filter) => (
          <Chip
            key={filter.id}
            label={filter.label}
            active={statusFilter === filter.id}
            onPress={() => {
              setStatusFilter(filter.id);
              logger.debug("subscription-payments", "status filter", { filter: filter.id });
            }}
          />
        ))}
      </View>

      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

      {filteredPayments.length === 0 ? (
        <EmptyState
          title="No transactions found"
          body={
            statusFilter !== "all"
              ? "Try a different status filter."
              : "Your subscription payments will appear here."
          }
        />
      ) : (
        filteredPayments.map((payment) => (
          <SubscriptionPaymentCard key={payment.id} payment={payment} />
        ))
      )}
    </Screen>
  );
}
