"use client";

import SignInForm from "~/components/forms/signInForm";
import { Card } from "~/components/ui/card";

export default function SignInPage() {
  return (
    <main className="flex h-screen items-center justify-center">
      <Card className="w-full max-w-[500px]">
        <SignInForm />
      </Card>
    </main>
  );
}
