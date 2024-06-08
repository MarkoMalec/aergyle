import React from "react";
import { Card } from "~/components/ui/card";

export default function PlayLayout({
  children,
  register,
  signin,
}: {
  children: React.ReactNode;
  register: React.ReactNode;
  signin: React.ReactNode;
}) {
  return (
    <main className="flex h-screen flex-col items-center justify-center">
      {children}
      <Card className="w-full max-w-[500px]">
        {register}
        <div className="relative flex items-center py-5 px-5">
          <div className="flex-grow border-t border-gray-400"></div>
          <span className="mx-2 flex-shrink text-gray-400">or</span>
          <div className="flex-grow border-t border-gray-400"></div>
        </div>

        {signin}
      </Card>
    </main>
  );
}
