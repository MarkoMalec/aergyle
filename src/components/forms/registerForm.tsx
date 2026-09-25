"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Check, Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { PasswordInput } from "~/components/auth/PasswordInput";
import { authErrorMessage } from "~/components/auth/authErrors";
import { authFieldClass } from "~/components/forms/signInForm";
import {
  PASSWORD_MIN,
  PLAYER_NAME_MAX,
  PLAYER_NAME_MIN,
  registerSchema,
  type RegisterInput,
} from "~/lib/auth-rules";
import { cn } from "~/lib/utils";

const FIELDS = new Set<keyof RegisterInput>(["name", "email", "password"]);

export default function RegisterForm({
  callbackUrl,
  onError,
}: {
  callbackUrl: string;
  onError: (message: string | null) => void;
}) {
  const [stage, setStage] = useState<"idle" | "signing-in" | "redirecting">(
    "idle",
  );
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
    mode: "onTouched",
  });
  const password = form.watch("password");

  const onSubmit = async (values: RegisterInput) => {
    onError(null);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => null);

    if (!response?.ok) {
      const data = (await response?.json().catch(() => null)) as {
        error?: string;
        field?: string;
      } | null;
      const field = data?.field as keyof RegisterInput | undefined;
      if (field && FIELDS.has(field) && data?.error) {
        form.setError(field, { message: data.error }, { shouldFocus: true });
      } else {
        onError(
          data?.error ?? "We couldn't create your account. Please try again.",
        );
      }
      return;
    }

    // The account exists; sign straight in rather than asking again.
    setStage("signing-in");
    const result = await signIn("credentials", {
      redirect: false,
      email: values.email,
      password: values.password,
      callbackUrl,
    }).catch(() => null);
    if (result && !result.error) {
      setStage("redirecting");
      window.location.assign(callbackUrl);
      return;
    }
    setStage("idle");
    onError(
      authErrorMessage(result?.error) ??
        "Your account is ready. Sign in to begin.",
    );
  };

  const busy = form.formState.isSubmitting || stage !== "idle";

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Character name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="nickname"
                  autoCapitalize="words"
                  spellCheck={false}
                  maxLength={PLAYER_NAME_MAX}
                  placeholder="e.g. Rowan Ashvale"
                  className={authFieldClass}
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-xs">
                {PLAYER_NAME_MIN}–{PLAYER_NAME_MAX} characters. Other players
                see this name.
              </FormDescription>
              <FormMessage className="text-danger" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  className={authFieldClass}
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-danger" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="new-password"
                  placeholder="Create a password"
                  className={authFieldClass}
                  {...field}
                />
              </FormControl>
              <p
                className={cn(
                  "flex items-center gap-1.5 text-xs transition-colors",
                  password.length >= PASSWORD_MIN
                    ? "text-success"
                    : "text-muted-foreground",
                )}
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                At least {PASSWORD_MIN} characters
              </p>
              <FormMessage className="text-danger" />
            </FormItem>
          )}
        />
        <Button type="submit" className="h-11 w-full text-[15px]" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {stage === "idle" ? "Creating your character…" : "Entering Aergyle…"}
            </>
          ) : (
            "Create character"
          )}
        </Button>
      </form>
    </Form>
  );
}
