import { useLocalSearchParams } from "expo-router";
import { ProviderProfileView } from "@/src/components/ProviderProfileView";

/** Read-only public profile preview for logged-in providers (customer stack redirects them). */
export default function ProviderPublicProfilePreview() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <ProviderProfileView slug={slug ?? ""} mode="preview" />;
}
