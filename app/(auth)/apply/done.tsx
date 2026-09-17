import { router } from "expo-router";
import { Button, Muted, Screen, Title } from "@/src/components/ui";

export default function ApplyDoneScreen() {
  return (
    <Screen>
      <Title>Application submitted</Title>
      <Muted>
        Thanks! We're reviewing your application and documents. We'll notify you once your
        provider account is approved.
      </Muted>
      <Button label="Go to dashboard" onPress={() => router.replace("/(provider)")} />
    </Screen>
  );
}
