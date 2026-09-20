import { useCallback, useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import {
  createMyPaymongoAccount,
  getMyPaymongoStatus,
  getMyPayoutDestination,
  refreshMyPaymongoStatus,
  setMyPayoutDestination,
  startMyPaymongoIdentity,
} from "@/src/api/providers";
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
import type {
  PayoutDestinationType,
  PayoutVerificationStatus,
  ProviderPaymongoStatus,
} from "@/src/types/api";
import { logger } from "@/src/utils/logger";
import { useProviderOnboardingHome } from "@/src/hooks/useProviderOnboardingHome";
import { router } from "expo-router";
import {
  normalizePhMobile,
  PH_MOBILE_ERROR,
  PH_MOBILE_HINT,
} from "@/src/utils/phone";

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

function paymongoStatusLabel(status: ProviderPaymongoStatus["paymongoOnboardingStatus"]): string {
  switch (status) {
    case "created":
      return "Account created";
    case "kyc_pending":
      return "Identity verification pending";
    case "kyc_passed":
      return "Identity verified — waiting for admin";
    case "ready_to_activate":
      return "Ready for admin activation";
    case "activated":
      return "Activated";
    case "declined":
      return "Verification declined";
    case "error":
      return "Error";
    default:
      return "Not started";
  }
}

export default function PayoutSettingsScreen() {
  const hidePlans = useProviderOnboardingHome();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymongoBusy, setPaymongoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<PayoutVerificationStatus | null>(
    null,
  );
  const [paymongo, setPaymongo] = useState<ProviderPaymongoStatus | null>(null);

  const [type, setType] = useState<PayoutDestinationType>("bank");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [data, pm] = await Promise.all([
        getMyPayoutDestination(),
        getMyPaymongoStatus().catch((e) => {
          logger.warn("provider-payout-settings", "paymongo status failed", e);
          return null;
        }),
      ]);
      setVerificationStatus(data.payoutVerificationStatus);
      if (data.payoutDestination) {
        setType(data.payoutDestination.type);
        setAccountName(data.payoutDestination.accountName);
        setAccountNumber(data.payoutDestination.accountNumber);
        setBankCode(data.payoutDestination.bankCode ?? "");
      }
      setPaymongo(pm);
      logger.info("provider-payout-settings", "loaded", {
        hasDestination: Boolean(data.payoutDestination),
        status: data.payoutVerificationStatus,
        paymongoStatus: pm?.paymongoOnboardingStatus,
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

    let accountNumberToSave = accountNumber.trim();
    if (type === "gcash" || type === "maya") {
      const normalized = normalizePhMobile(accountNumber);
      if (!normalized) {
        setError(PH_MOBILE_ERROR);
        logger.info("provider-payout-settings", "blocked — invalid PH e-wallet number", { type });
        return;
      }
      accountNumberToSave = normalized;
    }

    setSaving(true);
    try {
      const data = await setMyPayoutDestination({
        type,
        accountName: accountName.trim(),
        accountNumber: accountNumberToSave,
        ...(type === "bank" ? { bankCode: bankCode.trim() } : {}),
      });
      setVerificationStatus(data.payoutVerificationStatus);
      setAccountNumber(accountNumberToSave);
      setOk("Saved — your payout account is pending admin review.");
      logger.info("provider-payout-settings", "saved", { type, hasNormalizedPhone: type !== "bank" });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save payout settings");
      logger.error("provider-payout-settings", "save failed", e);
    } finally {
      setSaving(false);
    }
  };

  const isPaid =
    paymongo?.subscriptionTier === "pro" || paymongo?.subscriptionTier === "premium";

  const createPaymongo = async () => {
    setPaymongoBusy(true);
    setError(null);
    try {
      const data = await createMyPaymongoAccount();
      setPaymongo(data);
      logger.info("provider-payout-settings", "paymongo created", {
        id: data.paymongoSubAccountId,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create PayMongo account");
      logger.error("provider-payout-settings", "paymongo create failed", e);
    } finally {
      setPaymongoBusy(false);
    }
  };

  const startKyc = async () => {
    setPaymongoBusy(true);
    setError(null);
    try {
      const data = await startMyPaymongoIdentity();
      setPaymongo(data);
      if (data.paymongoIdentitySessionUrl) {
        await Linking.openURL(data.paymongoIdentitySessionUrl);
      } else {
        setError(
          "No hosted verification URL returned. Linked Accounts may not be enabled on PayMongo.",
        );
      }
      logger.info("provider-payout-settings", "paymongo kyc opened", {
        hasUrl: Boolean(data.paymongoIdentitySessionUrl),
        url: data.paymongoIdentitySessionUrl,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to start identity verification");
      logger.error("provider-payout-settings", "paymongo kyc failed", e);
    } finally {
      setPaymongoBusy(false);
    }
  };

  const refreshPaymongo = async () => {
    setPaymongoBusy(true);
    setError(null);
    try {
      const data = await refreshMyPaymongoStatus();
      setPaymongo(data);
      logger.info("provider-payout-settings", "paymongo refreshed", {
        status: data.paymongoOnboardingStatus,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to refresh PayMongo status");
      logger.error("provider-payout-settings", "paymongo refresh failed", e);
    } finally {
      setPaymongoBusy(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error && !accountName && !accountNumber && !paymongo) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <Screen scroll>
      <Title>Payout settings</Title>
      <Muted>
        Bank/e-wallet details are used for Option A disbursements. Pro/Premium providers can also
        verify a PayMongo sub-merchant for automatic booking splits (admin activates).
      </Muted>

      <Card>
        <Subtitle>PayMongo sub-merchant</Subtitle>
        <Text style={{ color: colors.textMuted, marginBottom: 8 }}>
          {paymongoStatusLabel(paymongo?.paymongoOnboardingStatus)}
          {paymongo?.paymongoSplitEnabled ? " · Splits enabled" : ""}
        </Text>
        {!isPaid ? (
          <>
            <Muted>
              {hidePlans
                ? "PayMongo payouts require a paid plan. Plans will be available soon."
                : "Upgrade to Pro or Premium to create a PayMongo account."}
            </Muted>
            {!hidePlans ? (
              <Button
                label="View plans"
                onPress={() => {
                  logger.info("provider-payout-settings", "open subscription");
                  router.push("/(provider)/subscription");
                }}
              />
            ) : null}
          </>
        ) : !paymongo?.paymongoSubAccountId ? (
          <Button
            label="Create PayMongo account"
            onPress={() => void createPaymongo()}
            loading={paymongoBusy}
          />
        ) : (
          <View style={styles.actions}>
            <Button
              label="Verify identity"
              onPress={() => void startKyc()}
              loading={paymongoBusy}
            />
            <Button
              label="Refresh status"
              variant="secondary"
              onPress={() => void refreshPaymongo()}
              loading={paymongoBusy}
            />
          </View>
        )}
        {paymongo?.paymongoLastError ? (
          <Text style={{ color: colors.danger, marginTop: 8 }}>{paymongo.paymongoLastError}</Text>
        ) : null}
      </Card>

      <Card>
        <Subtitle>Bank / e-wallet status</Subtitle>
        <Text style={{ color: verificationColor(verificationStatus), fontWeight: "600" }}>
          {verificationLabel(verificationStatus)}
        </Text>
      </Card>

      <Subtitle>Payout method (Option A)</Subtitle>
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
        placeholder={type === "bank" ? undefined : PH_MOBILE_HINT}
      />
      {type !== "bank" && accountNumber.trim() && !normalizePhMobile(accountNumber) ? (
        <Text style={{ color: colors.danger, fontSize: 12 }}>{PH_MOBILE_ERROR}</Text>
      ) : null}
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
  actions: {
    gap: 8,
  },
});
