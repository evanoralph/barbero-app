import { apiRequest } from "@/src/api/client";
import type {
  LoginResponse,
  ProviderApplyStartInput,
  ProviderApplySubmitInput,
  ProviderApplyUpdateInput,
  ProviderProfile,
} from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export function startProviderApply(input: ProviderApplyStartInput) {
  logger.info("provider-apply-api", "start", {
    email: input.email,
    turnstile: Boolean(input.turnstileToken),
  });
  return apiRequest<LoginResponse>("/providers/apply/start", {
    method: "POST",
    auth: false,
    body: input,
  });
}

export function updateProviderApply(input: ProviderApplyUpdateInput) {
  logger.info("provider-apply-api", "update", Object.keys(input));
  return apiRequest<ProviderProfile>("/providers/apply", {
    method: "PATCH",
    body: input,
  });
}

export function verifyProviderApplyEmail(code: string) {
  logger.info("provider-apply-api", "verifyEmail");
  return apiRequest<{ message: string }>("/providers/apply/verify-email", {
    method: "POST",
    body: { code },
  });
}

export function resendProviderApplyEmailCode() {
  logger.info("provider-apply-api", "resendEmailCode");
  return apiRequest<{ message: string }>("/providers/apply/resend-email-code", {
    method: "POST",
  });
}

export function submitProviderApply(input: ProviderApplySubmitInput) {
  logger.info("provider-apply-api", "submit", {
    proofs: input.proofDocuments.length,
    hasGovId: Boolean(input.governmentIdDocument?.url),
    hasSelfie: Boolean(input.selfieWithId?.url),
  });
  return apiRequest<ProviderProfile>("/providers/apply/submit", {
    method: "POST",
    body: input,
  });
}
