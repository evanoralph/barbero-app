import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMyProvider, listMyPortfolio, updateMyProvider } from "@/src/api/providers";
import { AnimatedPressable } from "@/src/components/animated/AnimatedPressable";
import { staggeredEntering } from "@/src/components/animated/staggeredEntering";
import { EmptyPortfolioIllustration } from "@/src/components/illustrations/EmptyPortfolioIllustration";
import { useProviderOnboardingHome } from "@/src/hooks/useProviderOnboardingHome";
import { PortfolioLightbox } from "@/src/components/PortfolioLightbox";
import type { PortfolioTile } from "@/src/components/PortfolioGrid";
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
import { ImageUploadField, type ImageUploadFieldHandle } from "@/src/components/ImageUploadField";
import type { PortfolioItem, ProviderProfile } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

type FormMode = "closed" | "add" | "edit";
type FilterId = "all" | "with-desc" | "no-desc";
const PAGE_SIZE = 10;

/** Hard paywall: no paid/trial entitlements → edits blocked (not a Free 3-item cap). */
function isProfileLocked(profile: ProviderProfile | null): boolean {
  if (!profile) return true;
  return !profile.isPremium && !profile.isFeatured;
}

function maxVisiblePortfolio(profile: ProviderProfile | null): number | null {
  if (!profile || isProfileLocked(profile)) return 0;
  if (profile.isFeatured) return null;
  if (profile.isPremium) return 50;
  return 0;
}

export default function ProviderPortfolioScreen() {
  const insets = useSafeAreaInsets();
  const hidePlans = useProviderOnboardingHome();
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [formMode, setFormMode] = useState<FormMode>("closed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [image, setImage] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const imageUploadRef = useRef<ImageUploadFieldHandle>(null);

  const closeForm = useCallback(() => {
    setFormMode("closed");
    setEditingId(null);
    setImage("");
    setTitle("");
    setDescription("");
    setFormError(null);
    logger.debug("provider-portfolio", "form close");
  }, []);

  const openAdd = () => {
    if (isProfileLocked(profile)) {
      logger.info("provider-portfolio", "blocked add — locked");
      console.log("[provider-portfolio] locked — block add");
      return;
    }
    setEditingId(null);
    setImage("");
    setTitle("");
    setDescription("");
    setFormError(null);
    setOk(null);
    setFormMode("add");
    logger.info("provider-portfolio", "form open add");
  };

  const openEdit = (item: PortfolioItem) => {
    if (isProfileLocked(profile)) {
      logger.info("provider-portfolio", "blocked edit — locked", { id: item.id });
      console.log("[provider-portfolio] locked — block edit", item.id);
      return;
    }
    setEditingId(item.id);
    setImage(item.image);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setFormError(null);
    setOk(null);
    setFormMode("edit");
    logger.info("provider-portfolio", "form open edit", { id: item.id });
  };

  const load = useCallback(async (opts?: { refresh?: boolean; keepPage?: boolean }) => {
    if (opts?.refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const targetPage = opts?.keepPage ? page : 1;
      const [me, paged] = await Promise.all([
        getMyProvider(),
        listMyPortfolio({
          page: targetPage,
          limit: PAGE_SIZE,
          q: query,
          filter,
        }),
      ]);
      setProfile(me);
      setItems(paged.items);
      setTotal(paged.total);
      setPage(paged.page);
      const locked = isProfileLocked(me);
      logger.info("provider-portfolio", "loaded", {
        portfolio: me.portfolio?.length ?? 0,
        page: paged.page,
        total: paged.total,
        filter,
        q: query,
        locked,
        isPremium: me.isPremium,
        isFeatured: me.isFeatured,
      });
      console.log("[provider-portfolio] loaded", {
        locked,
        isPremium: me.isPremium,
        isFeatured: me.isFeatured,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load portfolio";
      setError(msg);
      logger.error("provider-portfolio", "load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, page, query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(queryInput);
      setPage(1);
      logger.debug("provider-portfolio", "search debounced", { q: queryInput });
    }, 300);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const tiles: PortfolioTile[] = useMemo(
    () =>
      items.map((p) => ({
        id: p.id,
        image: p.image,
        title: p.title,
        description: p.description,
        likes: p.likes,
      })),
    [items],
  );

  const save = async () => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      setFormError("Title is required");
      return;
    }

    // For portfolio items, we defer local photo uploads until the user taps "Add item".
    // This prevents uploading an image the user selected but never saved.
    logger.debug("provider-portfolio", "save start (upload step)", {
      editingId,
      hasUrl: Boolean(image.trim()),
    });

    setSaving(true);
    setFormError(null);
    try {
      let imageUrl = image.trim();
      const uploaded = await imageUploadRef.current?.uploadNow();
      if (uploaded?.trim()) imageUrl = uploaded.trim();

      logger.debug("provider-portfolio", "save image upload result", {
        editingId,
        hasImageUrl: Boolean(imageUrl),
      });

      if (!imageUrl) {
        setFormError("Image is required");
        return;
      }

      const body = editingId
        ? {
            updatePortfolioItem: {
              id: editingId,
              image: imageUrl,
              title: trimmedTitle,
              ...(trimmedDescription ? { description: trimmedDescription } : {}),
            },
          }
        : {
            addPortfolioItem: {
              image: imageUrl,
              title: trimmedTitle,
              ...(trimmedDescription ? { description: trimmedDescription } : {}),
            },
          };
      logger.info("provider-portfolio", editingId ? "update" : "add", {
        id: editingId,
        title: trimmedTitle,
      });
      const updated = await updateMyProvider(body);
      setProfile(updated);
      setOk(editingId ? "Portfolio item updated" : "Portfolio item added");
      logger.info("provider-portfolio", "refresh after save");
      await load({ keepPage: true });
      closeForm();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setFormError(msg);
      logger.error("provider-portfolio", "save failed", e);
    } finally {
      setSaving(false);
    }
  };

  const remove = (item: PortfolioItem) => {
    if (isProfileLocked(profile)) {
      logger.info("provider-portfolio", "blocked remove — locked", { id: item.id });
      console.log("[provider-portfolio] locked — block remove", item.id);
      return;
    }
    Alert.alert("Remove portfolio item", `Remove “${item.title}”?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setSaving(true);
          setError(null);
          setOk(null);
          try {
            logger.info("provider-portfolio", "remove", { id: item.id });
            const updated = await updateMyProvider({
              removePortfolioItemId: item.id,
            });
            setProfile(updated);
            setOk("Portfolio item removed");
            logger.info("provider-portfolio", "refresh after remove", { id: item.id });
            await load({ keepPage: true });
            if (editingId === item.id) closeForm();
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Remove failed";
            setError(msg);
            logger.error("provider-portfolio", "remove failed", e);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const toggleVisibility = async (item: PortfolioItem) => {
    if (!profile) return;
    if (isProfileLocked(profile)) {
      logger.info("provider-portfolio", "blocked visibility — locked", { id: item.id });
      console.log("[provider-portfolio] locked — block visibility", item.id);
      setError("Subscribe to Pro or Premium to manage portfolio.");
      return;
    }
    const max = maxVisiblePortfolio(profile);
    const makeVisible = item.isVisible === false;
    const currentlyVisible = (profile.portfolio ?? [])
      .filter((x) => x.isVisible !== false)
      .map((x) => x.id);
    let next = currentlyVisible;
    if (makeVisible) {
      if (max !== null && currentlyVisible.length >= max && !currentlyVisible.includes(item.id)) {
        setError(`Your plan allows ${max} visible photos. Hide another first or upgrade.`);
        return;
      }
      next = currentlyVisible.includes(item.id) ? currentlyVisible : [...currentlyVisible, item.id];
    } else {
      next = currentlyVisible.filter((id) => id !== item.id);
    }
    setSaving(true);
    setError(null);
    try {
      logger.info("provider-portfolio", "toggle visibility", { id: item.id, makeVisible, next });
      const updated = await updateMyProvider({ visiblePortfolioIds: next });
      setProfile(updated);
      setOk(makeVisible ? "Photo shown on profile" : "Photo hidden from profile");
      await load({ keepPage: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update visibility");
      logger.error("provider-portfolio", "toggle visibility failed", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading portfolio…" />;
  if (error && !profile) return <ErrorState message={error} onRetry={() => load()} />;

  const modalVisible = formMode !== "closed";
  const locked = isProfileLocked(profile);

  return (
    <>
      <Screen scroll refreshing={refreshing} onRefresh={() => load({ refresh: true })}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Title>Portfolio</Title>
            <Muted>
              {items.length} of {total} shown
            </Muted>
          </View>
          {!locked ? <Button label="Add" onPress={openAdd} /> : null}
        </View>

        {locked ? (
          <View style={styles.paywallBox}>
            <Text style={styles.paywallTitle}>Subscribe to continue</Text>
            <Muted>
              {hidePlans
                ? "Portfolio edits require an active plan. Plans will be available soon."
                : "Portfolio edits require an active Pro or Premium plan."}
            </Muted>
            {!hidePlans ? (
              <Button
                label="View plans"
                onPress={() => {
                  logger.info("provider-portfolio", "paywall → subscription");
                  console.log("[provider-portfolio] paywall CTA → subscription");
                  router.push("/(provider)/subscription");
                }}
              />
            ) : null}
          </View>
        ) : null}

        <Field
          label="Search"
          value={queryInput}
          onChangeText={(v) => {
            setQueryInput(v);
            logger.debug("provider-portfolio", "search", { q: v });
          }}
          placeholder="Title, description, or URL"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {(
              [
                ["all", "All"],
                ["with-desc", "With description"],
                ["no-desc", "No description"],
              ] as const
            ).map(([id, label]) => (
              <Chip
                key={id}
                label={label}
                active={filter === id}
                onPress={() => {
                  setFilter(id);
                    setPage(1);
                  logger.debug("provider-portfolio", "filter", { filter: id });
                }}
              />
            ))}
          </View>
        </ScrollView>

        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        {ok ? <Text style={{ color: colors.success }}>{ok}</Text> : null}

        {total === 0 ? (
          <View style={styles.emptyBox}>
            <EmptyPortfolioIllustration />
            <Muted>No portfolio items yet. Add photos to showcase your work.</Muted>
            {!locked ? (
              <Button label="Add your first item" onPress={openAdd} />
            ) : !hidePlans ? (
              <Button
                label="Subscribe to add photos"
                onPress={() => router.push("/(provider)/subscription")}
              />
            ) : (
              <Muted>Plans will be available soon.</Muted>
            )}
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Muted>No items match your search or filter.</Muted>
            <Button
              label="Clear filters"
              variant="secondary"
              onPress={() => {
                setQuery("");
                setQueryInput("");
                setFilter("all");
                setPage(1);
                logger.debug("provider-portfolio", "clear filters");
              }}
            />
          </View>
        ) : (
          <View style={styles.list}>
            {items.map((item, index) => {
              const uri = (item.image || "").trim();
              return (
                <AnimatedPressable
                  key={item.id}
                  onPress={() => {
                    logger.debug("provider-portfolio", "open lightbox", { id: item.id, index });
                    setLightboxIndex(index);
                  }}
                  style={[styles.row, index < items.length - 1 && styles.rowBorder]}
                  entering={staggeredEntering(index)}
                >
                  {uri ? (
                    <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.thumb, styles.thumbFallback]}>
                      <Text style={styles.thumbLetter}>
                        {(item.title || "?").slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.title}
                      {item.isVisible === false ? " · Hidden" : ""}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {item.likes != null ? `${item.likes} likes` : "Portfolio"}
                      {item.createdAt
                        ? ` · ${new Date(item.createdAt).toLocaleDateString()}`
                        : ""}
                    </Text>
                    {item.description ? (
                      <Text style={styles.rowDesc} numberOfLines={2}>
                        {item.description}
                      </Text>
                    ) : (
                      <Text style={styles.rowDesc}>No description</Text>
                    )}
                  </View>
                  <View style={styles.rowActions}>
                    {!locked ? (
                      <>
                        <Pressable
                          onPress={() => void toggleVisibility(item)}
                          hitSlop={8}
                          style={styles.actionBtn}
                          disabled={saving}
                        >
                          <Text style={styles.actionEdit}>
                            {item.isVisible === false ? "Show" : "Hide"}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => openEdit(item)}
                          hitSlop={8}
                          style={styles.actionBtn}
                        >
                          <Text style={styles.actionEdit}>Edit</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => remove(item)}
                          hitSlop={8}
                          style={styles.actionBtn}
                          disabled={saving}
                        >
                          <Text style={styles.actionRemove}>Remove</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                </AnimatedPressable>
              );
            })}
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
                logger.debug("provider-portfolio", "page prev", { from: page });
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
                logger.debug("provider-portfolio", "page next", { from: page });
              }}
            />
          </View>
        ) : null}
      </Screen>

      <PortfolioLightbox
        items={tiles}
        initialIndex={lightboxIndex ?? 0}
        visible={lightboxIndex != null}
        onClose={() => setLightboxIndex(null)}
      />

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
              {formMode === "edit" ? "Edit portfolio item" : "Add portfolio item"}
            </Text>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
            >
              <ImageUploadField
                ref={imageUploadRef}
                label="Image"
                value={image}
                onChange={setImage}
                kind="provider-portfolio"
                previewStyle={styles.preview}
                uploadMode="manual"
                hideUrlInput
              />
              <Field label="Title" value={title} onChangeText={setTitle} />
              <Field
                label="Description (optional)"
                value={description}
                onChangeText={setDescription}
                multiline
              />
              {formError ? (
                <Text style={{ color: colors.danger }}>{formError}</Text>
              ) : null}
              <Button
                label={formMode === "edit" ? "Save changes" : "Add item"}
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
  paywallBox: {
    gap: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 14,
    backgroundColor: colors.bg,
  },
  paywallTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
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
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: colors.border,
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgDeep,
  },
  thumbLetter: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 20,
    fontFamily: fonts.serif,
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16,
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 12,
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
  preview: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    backgroundColor: colors.border,
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
