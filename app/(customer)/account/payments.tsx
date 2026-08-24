import { Muted, Screen, Title } from "@/src/components/ui";

export default function PaymentsStubScreen() {
  return (
    <Screen>
      <Title>Payments</Title>
      <Muted>
        Card payments are not available in this beta yet. Bookings are invite-only and
        payment is handled outside the app for now. We will notify you when in-app
        checkout launches.
      </Muted>
    </Screen>
  );
}
