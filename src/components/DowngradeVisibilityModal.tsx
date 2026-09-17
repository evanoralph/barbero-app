import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Button, Muted, Title } from "@/src/components/ui";
import type { PortfolioItem, ProviderService } from "@/src/types/api";
import { colors } from "@/src/theme/colors";
import { logger } from "@/src/utils/logger";

type Props = {
  visible: boolean;
  maxPortfolio: number;
  maxServices: number;
  portfolio: PortfolioItem[];
  services: ProviderService[];
  confirming?: boolean;
  onCancel: () => void;
  onConfirm: (selection: {
    visiblePortfolioIds: string[];
    visibleServiceIds: string[];
  }) => void;
};

function defaultIds(ids: string[], max: number): string[] {
  return ids.slice(0, Math.min(max, ids.length));
}

function toggleId(current: string[], id: string, max: number): string[] {
  if (current.includes(id)) return current.filter((x) => x !== id);
  if (current.length >= max) return current;
  return [...current, id];
}

export function DowngradeVisibilityModal({
  visible,
  maxPortfolio,
  maxServices,
  portfolio,
  services,
  confirming = false,
  onCancel,
  onConfirm,
}: Props) {
  const portfolioIds = useMemo(() => portfolio.map((p) => p.id), [portfolio]);
  const serviceIds = useMemo(() => services.map((s) => s.id), [services]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setSelectedPortfolio(defaultIds(portfolioIds, maxPortfolio));
    setSelectedServices(defaultIds(serviceIds, maxServices));
    logger.info("downgrade-picker", "opened", {
      maxPortfolio,
      maxServices,
      portfolio: portfolioIds.length,
      services: serviceIds.length,
    });
  }, [visible, portfolioIds, serviceIds, maxPortfolio, maxServices]);

  const needsPortfolio = portfolio.length > maxPortfolio;
  const needsServices = services.length > maxServices;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Title>Choose what stays public</Title>
          <Muted style={styles.desc}>
            Free plan shows up to {maxPortfolio} photos and {maxServices} services. First items are
            pre-selected. Hidden items stay in your account.
          </Muted>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {needsPortfolio ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Portfolio ({selectedPortfolio.length}/{maxPortfolio})
                </Text>
                {portfolio.map((item) => {
                  const checked = selectedPortfolio.includes(item.id);
                  const disabled = !checked && selectedPortfolio.length >= maxPortfolio;
                  return (
                    <Pressable
                      key={item.id}
                      disabled={disabled || confirming}
                      onPress={() =>
                        setSelectedPortfolio((prev) => toggleId(prev, item.id, maxPortfolio))
                      }
                      style={[styles.row, checked && styles.rowChecked, disabled && styles.rowDisabled]}
                    >
                      <Image source={{ uri: item.image }} style={styles.thumb} />
                      <Text style={styles.rowLabel} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text style={styles.check}>{checked ? "✓" : ""}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {needsServices ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  Services ({selectedServices.length}/{maxServices})
                </Text>
                {services.map((service) => {
                  const checked = selectedServices.includes(service.id);
                  const disabled = !checked && selectedServices.length >= maxServices;
                  return (
                    <Pressable
                      key={service.id}
                      disabled={disabled || confirming}
                      onPress={() =>
                        setSelectedServices((prev) => toggleId(prev, service.id, maxServices))
                      }
                      style={[styles.row, checked && styles.rowChecked, disabled && styles.rowDisabled]}
                    >
                      <Text style={styles.rowLabel} numberOfLines={2}>
                        {service.name}
                      </Text>
                      <Text style={styles.check}>{checked ? "✓" : ""}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {!needsPortfolio && !needsServices ? (
              <Muted>You are within Free limits. Everything stays public.</Muted>
            ) : null}
          </ScrollView>
          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={confirming} />
            <Button
              label={confirming ? "Switching…" : "Confirm Free"}
              onPress={() => {
                logger.info("downgrade-picker", "confirm", {
                  portfolio: selectedPortfolio.length,
                  services: selectedServices.length,
                });
                onConfirm({
                  visiblePortfolioIds: selectedPortfolio,
                  visibleServiceIds: selectedServices,
                });
              }}
              disabled={confirming}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 10,
  },
  desc: { marginBottom: 4 },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: 16, paddingBottom: 8 },
  section: { gap: 8 },
  sectionTitle: { fontWeight: "600", color: colors.text },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
  },
  rowChecked: { borderColor: colors.accent },
  rowDisabled: { opacity: 0.45 },
  thumb: { width: 44, height: 44, borderRadius: 6, backgroundColor: colors.surfaceAlt },
  rowLabel: { flex: 1, color: colors.text },
  check: { width: 20, textAlign: "center", color: colors.accent, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
});
