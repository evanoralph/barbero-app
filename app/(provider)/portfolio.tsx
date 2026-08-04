import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMyProvider, updateMyProvider } from "@/src/api/providers";
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
import type { PortfolioItem, ProviderProfile } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/fonts";
import { logger } from "@/src/utils/logger";

type FormMode = "closed" | "add" | "edit";
type FilterId = "all" | "with-desc" | "no-desc";

export default function ProviderPortfolioScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [formMode, setFormMode] = useState<FormMode>("closed");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [image, setImage] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

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
    setEditingId(item.id);
    setImage(item.image);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setFormError(null);
    setOk(null);
    setFormMode("edit");
    logger.info("provider-portfolio", "form open edit", { id: item.id });
  };

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    if (opts?.refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const me = await getMyProvider();
      setProfile(me);
      logger.info("provider-portfolio", "loaded", {
        portfolio: me.portfolio?.length ?? 0,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load portfolio";
      setError(msg);
      logger.error("provider-portfolio", "load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = profile?.portfolio ?? [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const hasDesc = Boolean(item.description?.trim());
      if (filter === "with-desc" && !hasDesc) return false;
      if (filter === "no-desc" && hasDesc) return false;
      if (!q) return true;
      const hay = `${item.title} ${item.description ?? ""} ${item.image}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query, filter]);

  const tiles: PortfolioTile[] = useMemo(
    () =>
      filtered.map((p) => ({
        id: p.id,
        image: p.image,
        title: p.title,
        description: p.description,
        likes: p.likes,
      })),
    [filtered],
  );

  const save = async () => {
    const imageUrl = image.trim();
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!imageUrl || !trimmedTitle) {
      setFormError("Image URL and title are required");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
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

  if (loading) return <LoadingState label="Loading portfolio…" />;
  if (error && !profile) return <ErrorState message={error} onRetry={() => load()} />;

  const modalVisible = formMode !== "closed";
  const previewUri = image.trim();

  return (
    <>
      <Screen scroll refreshing={refreshing} onRefresh={() => load({ refresh: true })}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Title>Portfolio</Title>
            <Muted>
              {filtered.length} of {items.length} shown
            </Muted>
          </View>
          <Button label="Add" onPress={openAdd} />
        </View>

        <Field
          label="Search"
          value={query}
          onChangeText={(v) => {
            setQuery(v);
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
                  logger.debug("provider-portfolio", "filter", { filter: id });
                }}
              />
            ))}
          </View>
        </ScrollView>

        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
        {ok ? <Text style={{ color: colors.success }}>{ok}</Text> : null}

        {items.length === 0 ? (
          <View style={styles.emptyBox}>
            <Muted>No portfolio items yet. Add photo URLs to showcase your work.</Muted>
            <Button label="Add your first item" onPress={openAdd} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Muted>No items match your search or filter.</Muted>
            <Button
              label="Clear filters"
              variant="secondary"
              onPress={() => {
                setQuery("");
                setFilter("all");
                logger.debug("provider-portfolio", "clear filters");
              }}
            />
          </View>
        ) : (
          <View style={styles.list}>
            {filtered.map((item, index) => {
              const uri = (item.image || "").trim();
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    logger.debug("provider-portfolio", "open lightbox", { id: item.id, index });
                    setLightboxIndex(index);
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    index < filtered.length - 1 && styles.rowBorder,
                    pressed && { opacity: 0.85 },
                  ]}
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
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
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
              {previewUri ? (
                <Image
                  source={{ uri: previewUri }}
                  style={styles.preview}
                  resizeMode="cover"
                  onError={() =>
                    logger.warn("provider-portfolio", "preview failed", {
                      image: previewUri,
                    })
                  }
                />
              ) : (
                <Muted>Image preview appears when you enter a URL.</Muted>
              )}
              <Field
                label="Image URL"
                value={image}
                onChangeText={setImage}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://…"
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
    ...StyleSheet.absoluteFillObject,
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
