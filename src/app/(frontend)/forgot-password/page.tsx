import { AuthCard } from "@/app/_components/auth-form";
import { ForgotPasswordForm } from "@/app/_components/account-entry-forms";

export default function Page() {
  return (
    <AuthCard title="Forgot your password?">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
