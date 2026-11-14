import {
  AccountResponse,
  CheckoutResponse,
  LoginResponse,
  LogoutResponse,
  MagicLinkResponse,
  type SessionUser,
  type ChangeEmailRequest,
  type ChangePasswordRequest,
  type DeleteAccountRequest,
  type DisablePublicLinkRequest,
  type LoginRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
  type UpdateAccountRequest,
} from "@/contracts";
import { apiClient } from "./api-client";

export const accountApi = {
  account: (signal?: AbortSignal): Promise<SessionUser> =>
    apiClient("/api/account", AccountResponse, { signal }),
  update: (body: UpdateAccountRequest) =>
    apiClient("/api/account", AccountResponse, { method: "PATCH", body }),
  remove: (body: DeleteAccountRequest) =>
    apiClient("/api/account", LogoutResponse, { method: "DELETE", body }),
  register: (body: RegisterRequest) =>
    apiClient("/api/auth/register", MagicLinkResponse, {
      method: "POST",
      body,
    }),
  login: (body: LoginRequest) =>
    apiClient("/api/auth/login", LoginResponse, { method: "POST", body }),
  resendVerification: () =>
    apiClient("/api/auth/resend-verification", MagicLinkResponse, {
      method: "POST",
      body: {},
    }),
  verifyEmail: (token: string) =>
    apiClient("/api/auth/verify-email", LogoutResponse, {
      method: "POST",
      body: { token },
    }),
  forgotPassword: (email: string) =>
    apiClient("/api/auth/forgot-password", MagicLinkResponse, {
      method: "POST",
      body: { email },
    }),
  resetPassword: (body: ResetPasswordRequest) =>
    apiClient("/api/auth/reset-password", LogoutResponse, {
      method: "POST",
      body,
    }),
  changePassword: (body: ChangePasswordRequest) =>
    apiClient("/api/auth/change-password", LogoutResponse, {
      method: "POST",
      body,
    }),
  changeEmail: (body: ChangeEmailRequest) =>
    apiClient("/api/auth/change-email", MagicLinkResponse, {
      method: "POST",
      body,
    }),
  logoutAll: () =>
    apiClient("/api/auth/logout-all", LogoutResponse, {
      method: "POST",
      body: {},
    }),
  portal: () =>
    apiClient("/api/billing/portal", CheckoutResponse, {
      method: "POST",
      body: {},
    }),
  disableLink: (body: DisablePublicLinkRequest) =>
    apiClient("/api/account/links", LogoutResponse, { method: "POST", body }),
};
