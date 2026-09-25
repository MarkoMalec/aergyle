/** Friendly text for NextAuth's error codes (and our own rate-limit code). */
const MESSAGES: Record<string, string> = {
  CredentialsSignin: "Incorrect email or password.",
  RateLimited:
    "Too many sign-in attempts. Please wait a few minutes and try again.",
  OAuthAccountNotLinked:
    "This email already belongs to an Aergyle account. Sign in with your email and password instead.",
  OAuthSignin: "Discord sign-in didn't finish. Please try again.",
  OAuthCallback: "Discord sign-in didn't finish. Please try again.",
  OAuthCreateAccount: "We couldn't create your account from Discord. Please try again.",
  Callback: "Discord sign-in didn't finish. Please try again.",
  AccessDenied: "Access was denied.",
  SessionRequired: "Please sign in to continue.",
  Configuration: "Sign-in is temporarily unavailable. Please try again later.",
};

export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? "Something went wrong. Please try again.";
}
