import { formatMoney } from "@/utils/format";
import { Text } from "react-native";
import { Card, Muted } from "@/src/components/ui";
import type { SubscriptionPayment } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";
import {
  billingPeriodLabel,
  formatSubscriptionDate,
  paymentStatusLabel,
  planNameForPayment,
} from "@/src/utils/subscriptionDisplay";

type Props = {
  payment: SubscriptionPayment;
};

export function SubscriptionPaymentCard({ payment }: Props) {
  logger.debug("SubscriptionPaymentCard", payment.id, payment.status);

  return (
    <Card>
      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
        {planNameForPayment(payment.planId)} · {formatMoney(payment.amount)}
      </Text>
      <Muted>
        {billingPeriodLabel(payment.billingPeriod)} · {formatSubscriptionDate(payment.paidAt)}
      </Muted>
      <Text
        style={{
          color: payment.status === "completed" ? colors.success : colors.danger,
          fontSize: 13,
          fontWeight: "600",
          marginTop: 4,
        }}
      >
        {paymentStatusLabel(payment.status)}
      </Text>
    </Card>
  );
}
