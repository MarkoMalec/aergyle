"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { PasswordInput } from "~/components/auth/PasswordInput";
import { authErrorMessage } from "~/components/auth/authErrors";
import { signInSchema, type SignInInput } from "~/lib/auth-rules";

/** Borderless, tinted fields shared by the sign-in and registration forms. */
export const authFieldClass =
  "h-11 border-transparent bg-surface-inset text-[15px] shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-primary/70";

export default function SignInForm({
  callbackUrl,
  onError,
}: {
  callbackUrl: string;
  onError: (message: string | null) => void;
}) {
  const [redirecting, setRedirecting] = useState(false);
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: SignInInput) => {
    onError(null);
    const result = await signIn("credentials", {
      redirect: false,
      email: values.email,
      password: values.password,
      callbackUrl,
    }).catch(() => null);

    if (result && !result.error) {
      setRedirecting(true);
      window.location.assign(callbackUrl);
      return;
    }
    onError(authErrorMessage(result?.error ?? "Default"));
    form.resetField("password");
    form.setFocus("password");
  };

  const busy = form.formState.isSubmitting || redirecting;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
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
                  autoComplete="current-password"
                  placeholder="Your password"
                  className={authFieldClass}
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-danger" />
            </FormItem>
          )}
        />
        <Button type="submit" className="h-11 w-full text-[15px]" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {redirecting ? "Entering Aergyle…" : "Signing in…"}
            </>
          ) : (
            "Sign in"
          )}
        </Button>
      </form>
    </Form>
  );
}
