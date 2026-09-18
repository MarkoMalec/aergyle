"use client";
import Link from "next/link";
import RegisterForm from "~/components/forms/registerForm";
import AuthShell from "~/components/game/ui/AuthShell";

export default function RegisterPage() {
  return (
    <AuthShell
      footer={
        <>
          Already a wayfarer? <Link href="/signin">Sign in</Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
