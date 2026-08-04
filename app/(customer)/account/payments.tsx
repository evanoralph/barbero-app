import { Muted, Screen, Title } from "@/src/components/ui";

export default function PaymentsStubScreen() {
  return (
    <Screen>
      <Title>Payments</Title>
      <Muted>
        Payment methods and Stripe checkout are deferred (same as web). This screen is a
        placeholder so the account module stays complete for v1.
      </Muted>
    </Screen>
  );
}
