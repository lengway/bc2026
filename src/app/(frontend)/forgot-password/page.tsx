import type { Metadata } from "next";
import { AuthCard } from "@/app/_components/auth-form";
import { ForgotPasswordForm } from "@/app/_components/account-entry-forms";

export const metadata: Metadata = { title: "Forgot Password" };

export default function Page() {
  return (
    <AuthCard title="Forgot your password?">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
