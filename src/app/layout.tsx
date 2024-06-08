import "~/styles/globals.css";

import React from "react";

import { GeistSans } from "geist/font/sans";

export const metadata = {
  title: "Aergyle",
  description: "Action packed game.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const RootLayout = async ({ children }: { children: React.ReactNode }) => {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;
