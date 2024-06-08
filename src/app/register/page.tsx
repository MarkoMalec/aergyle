"use client";

import RegisterForm from "~/components/forms/registerForm";
import { Card } from "~/components/ui/card";

export default function RegisterPage() {
  return (
    <main className="flex h-screen items-center justify-center">
      <Card className="w-full max-w-[500px]">
        <RegisterForm />
      </Card>
    </main>
  );
}
