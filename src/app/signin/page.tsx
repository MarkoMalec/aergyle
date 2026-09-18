"use client";
import Link from "next/link";
import SignInForm from "~/components/forms/signInForm";
import AuthShell from "~/components/game/ui/AuthShell";

export default function SignInPage() {
  return (
    <AuthShell
      footer={
        <>
          New to Aergyle? <Link href="/register">Begin your journey</Link>
        </>
      }
    >
      <SignInForm />
    </AuthShell>
  );
}
