import { Linking, Pressable, Text, View } from "react-native";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

const DEFAULT_PRIVACY_URL = "https://beru.app/privacy";
const DEFAULT_TERMS_URL = "https://beru.app/terms";

type LegalLinksProps = {
  privacyUrl?: string;
  termsUrl?: string;
};

export function LegalLinks({
  privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL ?? DEFAULT_PRIVACY_URL,
  termsUrl = process.env.EXPO_PUBLIC_TERMS_URL ?? DEFAULT_TERMS_URL,
}: LegalLinksProps) {
  const open = async (label: string, url: string) => {
    logger.info("legal", "opening link", { label, url });
    try {
      await Linking.openURL(url);
    } catch (error) {
      logger.warn("legal", "failed to open link", { label, url, error });
    }
  };

  return (
    <View style={{ gap: 8, marginTop: 16 }}>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>Legal</Text>
      <Pressable onPress={() => void open("Privacy Policy", privacyUrl)}>
        <Text style={{ color: colors.accent, fontSize: 15 }}>Privacy Policy</Text>
      </Pressable>
      <Pressable onPress={() => void open("Terms of Service", termsUrl)}>
        <Text style={{ color: colors.accent, fontSize: 15 }}>Terms of Service</Text>
      </Pressable>
    </View>
  );
}
