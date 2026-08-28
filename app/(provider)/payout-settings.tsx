import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getMyPayoutDestination, setMyPayoutDestination } from "@/src/api/providers";
import { ApiError } from "@/src/api/client";
import {
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  LoadingState,
  Muted,
  Screen,
  Subtitle,
  Title,
} from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import type { PayoutDestinationType, PayoutVerificationStatus } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

const TYPE_OPTIONS: { value: PayoutDestinationType; label: string }[] = [
  { value: "bank", label: "Bank" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
];

function verificationLabel(status: PayoutVerificationStatus | null): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "pending":
      return "Pending review";
    case "unverified":
      return "Unverified";
    default:
      return "Not submitted";
  }
}

function verificationColor(status: PayoutVerificationStatus | null): string {
  switch (status) {
    case "verified":
      return colors.success;
    case "pending":
      return colors.warning;
    default:
      return colors.textMuted;
  }
}

export default function PayoutSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<PayoutVerificationStatus | null>(
    null,
  );

  const [type, setType] = useState<PayoutDestinationType>("bank");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getMyPayoutDestination();
      setVerificationStatus(data.payoutVerificationStatus);
      if (data.payoutDestination) {
        setType(data.payoutDestination.type);
        setAccountName(data.payoutDestination.accountName);
        setAccountNumber(data.payoutDestination.accountNumber);
        setBankCode(data.payoutDestination.bankCode ?? "");
      }
      logger.info("provider-payout-settings", "loaded", {
        hasDestination: Boolean(data.payoutDestination),
        status: data.payoutVerificationStatus,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load payout settings");
      logger.error("provider-payout-settings", "load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setOk(null);
    setError(null);
    if (!accountName.trim() || !accountNumber.trim()) {
      setError("Account name and account number are required.");
      return;
    }
    if (type === "bank" && !bankCode.trim()) {
      setError("Bank code is required for bank transfers.");
      return;
    }

    setSaving(true);
    try {
      const data = await setMyPayoutDestination({
        type,
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        ...(type === "bank" ? { bankCode: bankCode.trim() } : {}),
      });
      setVerificationStatus(data.payoutVerificationStatus);
      setOk("Saved — your payout account is pending admin review.");
      logger.info("provider-payout-settings", "saved", { type });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save payout settings");
      logger.error("provider-payout-settings", "save failed", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !accountName && !accountNumber) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <Screen scroll>
      <Title>Payout settings</Title>
      <Muted>
        This is where your booking earnings get sent. We review new or changed payout
        accounts before the first payout goes out.
      </Muted>

      <Card>
        <Subtitle>Status</Subtitle>
        <Text style={{ color: verificationColor(verificationStatus), fontWeight: "600" }}>
          {verificationLabel(verificationStatus)}
        </Text>
      </Card>

      <Subtitle>Payout method</Subtitle>
      <View style={styles.chipRow}>
        {TYPE_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            active={type === option.value}
            onPress={() => setType(option.value)}
          />
        ))}
      </View>

      <Field
        label={type === "bank" ? "Account holder name" : `${type === "gcash" ? "GCash" : "Maya"} account name`}
        value={accountName}
        onChangeText={setAccountName}
        autoCapitalize="words"
      />
      <Field
        label={type === "bank" ? "Account number" : "Mobile number"}
        value={accountNumber}
        onChangeText={setAccountNumber}
        keyboardType={type === "bank" ? "number-pad" : "phone-pad"}
      />
      {type === "bank" ? (
        <Field
          label="Bank code (e.g. BDO, BPI, UBP)"
          value={bankCode}
          onChangeText={setBankCode}
          autoCapitalize="characters"
        />
      ) : null}

      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {ok ? <Text style={{ color: colors.success }}>{ok}</Text> : null}

      <Button label="Save payout settings" onPress={() => void save()} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
