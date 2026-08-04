import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { listFavoriteIds } from "@/src/api/favorites";
import { listProviders } from "@/src/api/providers";
import { ProviderCard } from "@/src/components/ProviderCard";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  Title,
} from "@/src/components/ui";
import type { ProviderListItem } from "@/src/types/api";

export default function SavedScreen() {
  const [items, setItems] = useState<ProviderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const favs = await listFavoriteIds();
      const all = await listProviders();
      setItems(all.filter((p) => favs.providerIds.includes(p._id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load saved");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <Screen scroll onRefresh={load}>
      <Title>Saved</Title>
      {items.length === 0 ? (
        <EmptyState title="No saved providers" body="Tap Save on a provider profile." />
      ) : (
        items.map((p) => (
          <ProviderCard
            key={p._id}
            provider={p}
            onPress={() => router.push(`/(customer)/provider/${p.slug}`)}
          />
        ))
      )}
    </Screen>
  );
}
