import { router } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { BrandLogo } from "@/src/components/BrandLogo";
import { Button, Muted, Screen, Title } from "@/src/components/ui";
import { useServerStatus } from "@/src/server/server-status";
import { logger } from "@/src/utils/logger";

export default function ServerDownScreen() {
  const { checkServerHealth } = useServerStatus();
  const [retrying, setRetrying] = useState(false);

  const onRetry = useCallback(async () => {
    logger.info("server", "retry tapped");
    setRetrying(true);
    try {
      const ok = await checkServerHealth();
      if (ok) {
        logger.info("server", "retry succeeded — navigating home");
        router.replace("/");
      } else {
        logger.warn("server", "retry failed — still unavailable");
      }
    } finally {
      setRetrying(false);
    }
  }, [checkServerHealth]);

  return (
    <Screen scroll onRefresh={onRetry} refreshing={retrying}>
      <View style={styles.hero}>
        <BrandLogo variant="lockup" style={styles.brandLogo} />
      </View>
      <Title>Server unavailable</Title>
      <Muted style={styles.body}>
        Beru can&apos;t reach the server right now. Please try again in a moment.
      </Muted>
      <Button label="Try again" onPress={onRetry} loading={retrying} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 48, marginBottom: 24, alignItems: "center" },
  brandLogo: { height: 148, width: 210, alignSelf: "center" },
  body: { marginBottom: 24, textAlign: "center" },
});
