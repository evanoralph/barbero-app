import { useLocalSearchParams } from "expo-router";
import { ProviderProfileView } from "@/src/components/ProviderProfileView";

export default function ProviderProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <ProviderProfileView slug={slug ?? ""} mode="customer" />;
}
