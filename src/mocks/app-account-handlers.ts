import { http, HttpResponse } from "msw";
import { z } from "zod";
import {
  ChangeEmailRequest,
  ChangePasswordRequest,
  DeleteAccountRequest,
  ForgotPasswordRequest,
  IntakeRequest,
  LoginRequest,
  Profile,
  RegisterRequest,
  ResetPasswordRequest,
  SessionUser,
  UpdateAccountRequest,
  type BillingSummary,
} from "@/contracts";
import { safeNextPath } from "@/app/_lib/auth/redirect";

const mockId = "20000000-0000-4000-8000-000000000001";
const defaultAccount: SessionUser = {
  id: mockId,
  email: "alex@example.com",
  displayName: "Alex Morgan",
  emailVerified: true,
  hasPassword: false,
  isGuest: false,
};
const demoProfile: Profile = {
  userId: mockId,
  intakeText:
    "Role: Account manager (account_management).\nExperience: 3–5 years.\nWants to practice: Discovery questions.",
  field: "sales",
  level: "intermediate",
  subfield: "account_management",
  years: 3,
  pains: [],
  goals: ["Understand customer needs"],
  updatedAt: "2026-11-14T08:00:00.000Z",
  dailyGoal: 1,
};

const accepted = () => HttpResponse.json({ accepted: true }, { status: 202 });
const ok = () => HttpResponse.json({ ok: true });
const invalid = (message: string) =>
  HttpResponse.json(
    { error: { code: "VALIDATION", message } },
    { status: 400 },
  );
const denied = (message: string) =>
  HttpResponse.json(
    { error: { code: "UNAUTHORIZED", message } },
    { status: 401 },
  );

export function createAppAccountHandlers({
  sessionActive,
  setSession,
  persist,
}: {
  sessionActive: () => boolean;
  setSession: (value: boolean) => void;
  persist: boolean;
}) {
  let user = defaultAccount;
  let profile: Profile | null = demoProfile;
  // Preview credentials live only in memory for one browser tab's walkthrough.
  let registered: RegisterRequest | undefined;
  let changedEmail: string | undefined;
  let verificationAvailable = false;
  const userKey = "bc2026.preview.account";
  const profileKey = "bc2026.preview.learning-profile";
  function saveUser(next: SessionUser) {
    user = next;
    if (persist) sessionStorage.setItem(userKey, JSON.stringify(user));
  }
  function restore() {
    if (!persist) return;
    const savedUser = SessionUser.safeParse(
      JSON.parse(sessionStorage.getItem(userKey) ?? "null"),
    );
    if (savedUser.success) user = savedUser.data;
    const savedProfile = Profile.nullable().safeParse(
      JSON.parse(sessionStorage.getItem(profileKey) ?? "false"),
    );
    if (savedProfile.success) profile = savedProfile.data;
  }
  function session() {
    restore();
    return { user, expiresAt: new Date(Date.now() + 3_600_000).toISOString() };
  }
  const billing: BillingSummary = {
    plan: "free",
    freeDailyRemaining: 1,
    periodEnd: null,
    canManage: false,
  };
  return [
    http.get("*/api/auth/session", () =>
      HttpResponse.json(sessionActive() ? session() : null),
    ),
    http.post("*/api/auth/register", async ({ request }) => {
      const input = RegisterRequest.safeParse(await request.json());
      if (!input.success) return invalid("Check your account details.");
      registered = input.data;
      verificationAvailable = true;
      return accepted();
    }),
    http.post("*/api/auth/login", async ({ request }) => {
      const input = LoginRequest.safeParse(await request.json());
      if (!input.success) return invalid("Enter your email and password.");
      if (
        !registered ||
        registered.email !== input.data.email ||
        registered.password !== input.data.password
      )
        return denied("Email or password is incorrect.");
      setSession(true);
      saveUser({
        ...defaultAccount,
        displayName: registered.displayName,
        email: changedEmail ?? registered.email,
        hasPassword: true,
        emailVerified: !verificationAvailable,
      });
      return HttpResponse.json({
        session: session(),
        next: safeNextPath(input.data.next ?? null),
      });
    }),
    http.post("*/api/auth/verify-email", async ({ request }) => {
      const input = z
        .object({ token: z.string() })
        .safeParse(await request.json());
      if (
        !input.success ||
        input.data.token !== "preview-registration-confirmation-link" ||
        !registered ||
        !verificationAvailable
      )
        return denied("This link has expired or was already used.");
      setSession(true);
      saveUser({
        ...defaultAccount,
        displayName: registered.displayName,
        email: changedEmail ?? registered.email,
        hasPassword: true,
        emailVerified: true,
      });
      verificationAvailable = false;
      return ok();
    }),
    http.post("*/api/auth/resend-verification", () =>
      sessionActive() ? accepted() : denied("Sign in to continue."),
    ),
    http.post("*/api/auth/forgot-password", async ({ request }) =>
      ForgotPasswordRequest.safeParse(await request.json()).success
        ? accepted()
        : invalid("Enter a valid email address."),
    ),
    http.post("*/api/auth/reset-password", async ({ request }) => {
      const input = ResetPasswordRequest.safeParse(await request.json());
      if (!input.success || !registered)
        return denied("This link has expired or was already used.");
      registered = { ...registered, password: input.data.password };
      return ok();
    }),
    http.post("*/api/auth/change-password", async ({ request }) => {
      if (!sessionActive()) return denied("Sign in to continue.");
      const input = ChangePasswordRequest.safeParse(await request.json());
      if (!input.success) return invalid("Enter a valid password.");
      if (registered && input.data.currentPassword !== registered.password)
        return denied("Confirm your current password.");
      const { email, displayName } = session().user;
      registered = {
        email,
        displayName: displayName ?? "Alex Morgan",
        password: input.data.password,
      };
      saveUser({ ...user, hasPassword: true });
      return ok();
    }),
    http.post("*/api/auth/change-email", async ({ request }) => {
      if (!sessionActive()) return denied("Sign in to continue.");
      const input = ChangeEmailRequest.safeParse(await request.json());
      if (!input.success) return invalid("Enter a valid email address.");
      changedEmail = input.data.email;
      verificationAvailable = true;
      return accepted();
    }),
    http.post("*/api/auth/logout-all", () => {
      setSession(false);
      return ok();
    }),
    http.get("*/api/account", () => HttpResponse.json(session().user)),
    http.patch("*/api/account", async ({ request }) => {
      const input = UpdateAccountRequest.safeParse(await request.json());
      if (!input.success) return invalid("Enter your full name.");
      saveUser({ ...session().user, displayName: input.data.displayName });
      return HttpResponse.json(user);
    }),
    http.delete("*/api/account", async ({ request }) => {
      const input = DeleteAccountRequest.safeParse(await request.json());
      if (!input.success)
        return invalid("Confirm that you wish to delete your account.");
      setSession(false);
      registered = undefined;
      saveUser(defaultAccount);
      return ok();
    }),
    http.get("*/api/billing/summary", () => HttpResponse.json(billing)),
    http.post("*/api/billing/portal", ({ request }) =>
      HttpResponse.json({
        url: new URL("/settings/billing", request.url).href,
      }),
    ),
    http.get("*/api/intake", () => {
      restore();
      return HttpResponse.json(profile);
    }),
    http.post("*/api/intake", async ({ request }) => {
      const input = IntakeRequest.safeParse(await request.json());
      if (!input.success) return invalid("Please check your profile details.");
      restore();
      profile = {
        ...demoProfile,
        field: input.data.field,
        subfield:
          /^Role: [^(]+\(([^)]+)\)/m.exec(input.data.text)?.[1] ??
          demoProfile.subfield,
        years:
          input.data.years ??
          Number(
            /(?:Experience: (?:Under )?)?(\d+)/.exec(input.data.text)?.[1] ?? 0,
          ),
        intakeText: input.data.text,
        level: input.data.level,
        dailyGoal: input.data.dailyGoal ?? profile?.dailyGoal ?? 1,
        updatedAt: new Date().toISOString(),
      };
      if (persist) sessionStorage.setItem(profileKey, JSON.stringify(profile));
      return HttpResponse.json(profile);
    }),
  ];
}
