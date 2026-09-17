import { Image, StyleSheet, Text, View } from "react-native";
import type { LoyaltyCardView, ProviderProfile } from "@/src/types/api";
import { fonts } from "@/src/theme/fonts";

const BERU_STAMP_LOGO = require("../../assets/logo/beru-logo-white.png");

type Props = {
  program: NonNullable<ProviderProfile["loyaltyProgram"]>;
  card?: LoyaltyCardView | null;
};

export function LoyaltyStampBanner({ program, card }: Props) {
  if (!program.enabled) return null;

  const rewardLabel =
    program.rewardDiscountPercent >= 100
      ? "a free visit"
      : `${program.rewardDiscountPercent}% off`;

  if (card?.rewardReady) {
    return (
      <View style={styles.box} testID="loyalty-reward-ready">
        <Text style={styles.title}>Loyalty reward ready</Text>
        <Text style={styles.body}>
          Your next booking gets {rewardLabel} automatically.
        </Text>
      </View>
    );
  }

  const stamps = card?.stamps ?? 0;
  const required = program.stampsRequired;

  if (__DEV__) {
    console.log("[LoyaltyStampBanner] progress", { stamps, required });
  }

  return (
    <View style={styles.box} testID="loyalty-stamp-progress">
      <Text style={styles.title}>
        Loyalty stamps · {stamps} / {required}
      </Text>
      <Text style={styles.body}>
        Complete {required} visits for {rewardLabel}.
      </Text>
      <View style={styles.dots}>
        {Array.from({ length: required }, (_, i) => {
          const filled = i < stamps;
          return (
            <View key={i} style={styles.dotSlot}>
              <View
                style={[styles.dot, filled ? styles.dotFilled : styles.dotEmpty]}
              >
                {filled ? (
                  <Image
                    source={BERU_STAMP_LOGO}
                    style={styles.dotLogo}
                    resizeMode="contain"
                    accessibilityLabel="Beru stamp"
                  />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D4D4D4",
    backgroundColor: "#FAFAFA",
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  title: {
    fontFamily: fonts.serifMedium,
    fontSize: 15,
    color: "#0A0A0A",
  },
  body: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: "#6B6B6B",
    lineHeight: 18,
  },
  dots: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  dotSlot: {
    width: "20%",
    alignItems: "center",
    paddingVertical: 4,
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dotFilled: {
    backgroundColor: "#0A0A0A",
    borderColor: "#0A0A0A",
  },
  dotEmpty: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D4D4D4",
  },
  dotLogo: {
    width: 24,
    height: 24,
  },
});
