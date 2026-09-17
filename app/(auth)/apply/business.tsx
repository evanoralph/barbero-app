import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { listCategories } from "@/src/api/categories";
import { ApiError } from "@/src/api/client";
import { updateProviderApply } from "@/src/api/providerApply";
import { Button, Chip, Field, Muted, Screen, Title } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import type { ServiceCategory } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

const FALLBACK_CATEGORIES: ServiceCategory[] = [
  { slug: "barber", name: "Barber", sortOrder: 0 },
  { slug: "tattoo", name: "Tattoo", sortOrder: 1 },
  { slug: "nails", name: "Nails", sortOrder: 2 },
  { slug: "salon", name: "Salon", sortOrder: 3 },
];

export default function ApplyBusinessScreen() {
  const [categories, setCategories] = useState<ServiceCategory[]>(FALLBACK_CATEGORIES);
  const [name, setName] = useState("");
  const [categorySlug, setCategorySlug] = useState("barber");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listCategories()
      .then((rows) => {
        if (rows.length) {
          setCategories(rows);
          setCategorySlug(rows[0].slug);
        }
      })
      .catch((e) => logger.warn("apply-business", "categories fallback", e));
  }, []);

  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      await updateProviderApply({
        name: name.trim(),
        categorySlug,
        bio: bio.trim(),
      });
      router.push("/(auth)/apply/location");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to save business info");
      logger.warn("apply-business", "failed", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Title>Your business</Title>
      <Muted>Tell clients who you are. You can refine your public profile after approval.</Muted>
      <Field
        label="Business or professional name"
        value={name}
        onChangeText={setName}
      />
      <Muted>Category</Muted>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {categories.map((c) => (
            <Chip
              key={c.slug}
              label={c.name}
              active={categorySlug === c.slug}
              onPress={() => setCategorySlug(c.slug)}
            />
          ))}
        </View>
      </ScrollView>
      <Field
        label="Short bio"
        value={bio}
        onChangeText={setBio}
        multiline
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button label="Continue" onPress={onSubmit} loading={loading} disabled={!name.trim()} />
    </Screen>
  );
}
