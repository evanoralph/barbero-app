import { useLocalSearchParams } from "expo-router";
import { LoadingState } from "@/src/components/ui";
import { ProviderProfileView } from "@/src/components/ProviderProfileView";
import { useDiscoveryDisabledRedirect } from "@/src/hooks/useDiscoveryDisabledRedirect";

export default function ProviderProfileScreen() {
  const discoveryDisabled = useDiscoveryDisabledRedirect("provider");
  const { slug } = useLocalSearchParams<{ slug: string }>();

  if (discoveryDisabled) {
    return <LoadingState />;
  }

  return <ProviderProfileView slug={slug ?? ""} mode="customer" />;
}
