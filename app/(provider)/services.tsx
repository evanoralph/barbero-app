import { formatMoney } from '@/utils/format';
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { listCategories } from "@/src/api/categories";
import { getMyProvider, listMyServices, updateMyProvider } from "@/src/api/providers";
import { AnimatedPressable } from "@/src/components/animated/AnimatedPressable";
import { staggeredEntering } from "@/src/components/animated/staggeredEntering";
import { EmptyServicesIllustration } from "@/src/components/illustrations/EmptyServicesIllustration";
import {
  Button,
  Chip,
  ErrorState,
  Field,
  LoadingState,
  Muted,
  Screen,
  Title,
} from "@/src/components/ui";
import { ImageUploadField } from "@/src/components/ImageUploadField";
import type { ProviderProfile, ProviderService, ServiceCategory } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

type FormMode = "closed" | "add" | "edit";
const PAGE_SIZE = 10;

export default function ProviderServicesScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [services, setServices] = useState<ProviderService[]>([]);

  const [formMode, setFormMode] = useState<FormMode>("closed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("45");
  const [category, setCategory] = useState("");
  const [image, setImage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const seedCategory = useCallback(() => {
    return profile?.categorySlug || categories[0]?.slug || "";
  }, [profile?.categorySlug, categories]);

  const closeForm = useCallback(() => {
    setFormMode("closed");
    setEditingId(null);
    setName("");
    setDescription("");
    setPrice("");
    setDuration("45");
    setCategory(seedCategory());
    setImage("");
    setFormError(null);
    logger.debug("provider-services", "form close");
  }, [seedCategory]);

  const openAdd = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setPrice("");
    setDuration("45");
    setCategory(seedCategory());
    setImage("");
    setFormError(null);
    setOk(null);
    setFormMode("add");
    logger.info("provider-services", "form open add");
  };

  const openEdit = (s: ProviderService) => {
    setEditingId(s.id);
    setName(s.name);
    setDescription(s.description);
    setPrice(String(s.price));
    setDuration(String(s.durationMinutes));
    setCategory(s.category);
    setImage(s.image ?? "");
    setFormError(null);
    setOk(null);
    setFormMode("edit");
    logger.info("provider-services", "form open edit", { id: s.id });
  };

  const load = useCallback(async (opts?: { refresh?: boolean; keepPage?: boolean }) => {
    if (opts?.refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const targetPage = opts?.keepPage ? page : 1;
      const [me, paged, cats] = await Promise.all([
        getMyProvider(),
        listMyServices({
          page: targetPage,
          limit: PAGE_SIZE,
          q: query,
          category: filterCategory,
        }),
        listCategories().catch((e) => {
          logger.warn("provider-services", "categories load failed", e);
          return [] as ServiceCategory[];
        }),
      ]);
      setProfile(me);
      setServices(paged.items);
      setTotal(paged.total);
      setPage(paged.page);
      setCategories(cats);
      logger.info("provider-services", "loaded", {
        services: paged.items.length,
        total: paged.total,
        page: paged.page,
        categories: cats.length,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load services";
      setError(msg);
      logger.error("provider-services", "load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterCategory, page, query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(queryInput);
      setPage(1);
      logger.debug("provider-services", "search debounced", { q: queryInput });
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const filterOptions = useMemo(() => {
    const fromServices = new Set(services.map((s) => s.category).filter(Boolean));
    const fromApi = categories.map((c) => c.slug);
    const merged = Array.from(new Set([...fromApi, ...fromServices])).sort();
    return merged;
  }, [services, categories]);

  const save = async () => {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const trimmedCategory = category.trim() || seedCategory() || "General";
    const priceNum = Number(price);
    const durationMinutes = Math.round(Number(duration));

    if (!trimmedName || !trimmedDescription) {
      setFormError("Service name and description are required");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setFormError("Enter a valid service price");
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setFormError("Enter a valid duration in minutes");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const body = editingId
        ? {
            updateService: {
              id: editingId,
              name: trimmedName,
              description: trimmedDescription,
              price: priceNum,
              durationMinutes,
              category: trimmedCategory,
              ...(image.trim() ? { image: image.trim() } : {}),
            },
          }
        : {
            addService: {
              name: trimmedName,
              description: trimmedDescription,
              price: priceNum,
              durationMinutes,
              category: trimmedCategory,
              ...(image.trim() ? { image: image.trim() } : {}),
            },
          };
      logger.info("provider-services", editingId ? "update" : "add", {
        id: editingId,
        name: trimmedName,
        price: priceNum,
      });
      const updated = await updateMyProvider(body);
      setProfile(updated);
      setOk(editingId ? "Service updated" : "Service added");
      logger.info("provider-services", "refresh after save");
      await load({ keepPage: true });
      closeForm();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setFormError(msg);
      logger.error("provider-services", "save failed", e);
    } finally {
      setSaving(false);
    }
  };

  const remove = (s: ProviderService) => {
    Alert.alert("Remove service", `Remove “${s.name}”?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          setError(null);
          setOk(null);
          try {
            logger.info("provider-services", "remove", { id: s.id });
            const updated = await updateMyProvider({ removeServiceId: s.id });
            setProfile(updated);
            setOk("Service removed");
            logger.info("provider-services", "refresh after remove", { id: s.id });
            await load({ keepPage: true });
            if (editingId === s.id) closeForm();
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Remove failed";
            setError(msg);
            logger.error("provider-services", "remove failed", e);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingState label="Loading services…" />;
  if (error && !profile) return <ErrorState message={error} onRetry={() => load()} />;

  const modalVisible = formMode !== "closed";

  return (
    <>
      <Screen scroll refreshing={refreshing} onRefresh={() => load({ refresh: true, keepPage: true })}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Title>Services</Title>
            <Muted>
              {services.length} of {total} shown
            </Muted>
          </View>
          <Button label="Add" onPress={openAdd} />
        </View>

        <Field
          label="Search"
          value={queryInput}
          onChangeText={(v) => {
            setQueryInput(v);
            logger.debug("provider-services", "search", { q: v });
          }}
          placeholder="Name, description, category"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            <Chip
              label="All"
              active={filterCategory === "all"}
              onPress={() => {
                setFilterCategory("all");
                setPage(1);
                logger.debug("provider-services", "filter", { category: "all" });
              }}
            />
            {filterOptions.map((cat) => (
              <Chip
                key={cat}
                label={categories.find((c) => c.slug === cat)?.name ?? cat}
                active={filterCategory === cat}
                onPress={() => {
                  setFilterCategory(cat);
                  setPage(1);
                  logger.debug("provider-services", "filter", { category: cat });
                }}
              />
            ))}
          </View>
        </ScrollView>

        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        {ok ? <Text style={{ color: colors.success }}>{ok}</Text> : null}

        {total === 0 ? (
          <View style={styles.emptyBox}>
            <EmptyServicesIllustration />
            <Muted>No services yet.</Muted>
            <Button label="Add your first service" onPress={openAdd} />
          </View>
        ) : services.length === 0 ? (
          <View style={styles.emptyBox}>
            <Muted>No services match your search or filter.</Muted>
            <Button
              label="Clear filters"
              variant="secondary"
              onPress={() => {
                setQuery("");
                setQueryInput("");
                setFilterCategory("all");
                setPage(1);
                logger.debug("provider-services", "clear filters");
              }}
            />
          </View>
        ) : (
          <View style={styles.list}>
            {services.map((s, index) => (
              <AnimatedPressable
                key={s.id}
                onPress={() => openEdit(s)}
                style={[styles.row, index < services.length - 1 && styles.rowBorder]}
                entering={staggeredEntering(index)}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {formatMoney(s.price)} · {s.durationMinutes} min · {s.category}
                  </Text>
                  {s.description ? (
                    <Text style={styles.rowDesc} numberOfLines={2}>
                      {s.description}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.rowActions}>
                  <Pressable
                    onPress={() => openEdit(s)}
                    hitSlop={8}
                    style={styles.actionBtn}
                  >
                    <Text style={styles.actionEdit}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => remove(s)}
                    hitSlop={8}
                    style={styles.actionBtn}
                    disabled={saving}
                  >
                    <Text style={styles.actionRemove}>Remove</Text>
                  </Pressable>
                </View>
              </AnimatedPressable>
            ))}
          </View>
        )}
        {total > PAGE_SIZE ? (
          <View style={styles.pageRow}>
            <Button
              label="Previous"
              variant="secondary"
              disabled={page <= 1 || loading}
              onPress={() => {
                setPage((p) => Math.max(1, p - 1));
                logger.debug("provider-services", "page prev", { from: page });
              }}
            />
            <Muted>
              Page {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
            </Muted>
            <Button
              label="Next"
              variant="secondary"
              disabled={page >= Math.max(1, Math.ceil(total / PAGE_SIZE)) || loading}
              onPress={() => {
                setPage((p) => p + 1);
                logger.debug("provider-services", "page next", { from: page });
              }}
            />
          </View>
        ) : null}
      </Screen>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeForm}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeForm} />
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {formMode === "edit" ? "Edit service" : "Add service"}
            </Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
            >
              <Field label="Name" value={name} onChangeText={setName} />
              <Field
                label="Description"
                value={description}
                onChangeText={setDescription}
                multiline
              />
              <Field
                label="Price"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
              <Field
                label="Duration (min)"
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
              />
              <Field label="Category" value={category} onChangeText={setCategory} />
              <ImageUploadField
                label="Service image URL (optional)"
                value={image}
                onChange={setImage}
                kind="provider-service"
                serviceId={editingId ?? undefined}
                previewStyle={{
                  width: 72,
                  height: 72,
                  borderRadius: 12,
                  alignSelf: "flex-start",
                }}
              />
              {categories.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.chipRow}>
                    {categories.map((c) => (
                      <Chip
                        key={c.slug}
                        label={c.name}
                        active={category === c.slug || category === c.name}
                        onPress={() => {
                          setCategory(c.slug);
                          logger.debug("provider-services", "pick category", {
                            slug: c.slug,
                          });
                        }}
                      />
                    ))}
                  </View>
                </ScrollView>
              ) : null}
              {formError ? (
                <Text style={{ color: colors.danger }}>{formError}</Text>
              ) : null}
              <Button
                label={formMode === "edit" ? "Save changes" : "Add service"}
                onPress={save}
                loading={saving}
              />
              <Button label="Cancel" variant="secondary" onPress={closeForm} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 8,
    paddingVertical: 2,
  },
  emptyBox: {
    gap: 12,
    paddingVertical: 24,
    alignItems: "flex-start",
  },
  pageRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.surface,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16,
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.mono,
  },
  rowDesc: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  rowActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  actionEdit: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 13,
    fontFamily: fonts.monoMedium,
  },
  actionRemove: {
    color: colors.danger,
    fontWeight: "600",
    fontSize: 13,
    fontFamily: fonts.mono,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    // RN 0.86 types: absoluteFillObject removed; absoluteFill is the same style object
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "88%",
    gap: 10,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontFamily: fonts.serif,
    marginBottom: 4,
  },
});
