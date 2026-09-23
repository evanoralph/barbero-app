/**
 * Short-lived in-memory store for the login OTP challengeId.
 * Avoid putting the challenge in the URL; cleared after verify success or explicit clear.
 */
let pendingChallengeId: string | null = null;
let pendingEmail: string | null = null;
let pendingDevCode: string | null = null;

export function setLoginOtpChallenge(
  email: string,
  challengeId: string,
  devCode?: string,
): void {
  pendingEmail = email.trim().toLowerCase();
  pendingChallengeId = challengeId;
  pendingDevCode = devCode ?? null;
  console.log("[auth] login OTP challenge stored", {
    email: pendingEmail,
    hasDevCode: Boolean(pendingDevCode),
  });
}

export function getLoginOtpChallenge(): {
  email: string;
  challengeId: string;
  devCode?: string;
} | null {
  if (!pendingEmail || !pendingChallengeId) return null;
  return {
    email: pendingEmail,
    challengeId: pendingChallengeId,
    ...(pendingDevCode ? { devCode: pendingDevCode } : {}),
  };
}

export function updateLoginOtpChallengeId(challengeId: string, devCode?: string): void {
  if (!pendingEmail) return;
  pendingChallengeId = challengeId;
  if (devCode !== undefined) {
    pendingDevCode = devCode;
  }
  console.log("[auth] login OTP challengeId updated after resend", {
    email: pendingEmail,
    hasDevCode: Boolean(pendingDevCode),
  });
}

export function clearLoginOtpChallenge(): void {
  console.log("[auth] login OTP challenge cleared", { email: pendingEmail });
  pendingEmail = null;
  pendingChallengeId = null;
  pendingDevCode = null;
}
