import { apiRequest } from "@/src/api/client";
import type { AuthMe, LoginResponse } from "@/src/types/api";
import { logger } from "@/src/utils/logger";

export async function login(email: string, password: string): Promise<LoginResponse> {
  logger.info("auth-api", "login attempt", { email });
  return apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
}

export async function authMe(): Promise<AuthMe> {
  logger.debug("auth-api", "authMe");
  return apiRequest<AuthMe>("/auth/me");
}

export async function logout(): Promise<void> {
  logger.info("auth-api", "logout");
  await apiRequest<{ message: string }>("/auth/logout", { method: "POST" });
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  logger.info("auth-api", "forgotPassword", { email });
  return apiRequest<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    auth: false,
    body: { email },
  });
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ message: string }> {
  logger.info("auth-api", "resetPassword");
  return apiRequest<{ message: string }>("/auth/reset-password", {
    method: "POST",
    auth: false,
    body: { token, password },
  });
}

export async function registerStart(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ message: string }> {
  logger.info("auth-api", "registerStart", { email: input.email });
  return apiRequest<{ message: string }>("/auth/register/start", {
    method: "POST",
    auth: false,
    body: input,
  });
}

export async function registerVerify(input: {
  email: string;
  code: string;
}): Promise<LoginResponse> {
  logger.info("auth-api", "registerVerify", { email: input.email });
  return apiRequest<LoginResponse>("/auth/register/verify", {
    method: "POST",
    auth: false,
    body: input,
  });
}

export async function registerResend(email: string): Promise<{ message: string }> {
  logger.info("auth-api", "registerResend", { email });
  return apiRequest<{ message: string }>("/auth/register/resend", {
    method: "POST",
    auth: false,
    body: { email },
  });
}
