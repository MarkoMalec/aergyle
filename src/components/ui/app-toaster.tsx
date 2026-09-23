"use client";

import { Toaster } from "react-hot-toast";

/** The one toast container, themed from the surrounding CSS variables. */
export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 6000,
        style: {
          background: "hsl(var(--popover))",
          borderRadius: "12px",
          color: "hsl(var(--foreground))",
        },
        success: {
          duration: 6000,
          iconTheme: {
            primary: "hsl(var(--success))",
            secondary: "hsl(var(--background))",
          },
        },
        error: {
          duration: 6000,
          iconTheme: {
            primary: "hsl(var(--danger))",
            secondary: "hsl(var(--background))",
          },
        },
      }}
    />
  );
}
