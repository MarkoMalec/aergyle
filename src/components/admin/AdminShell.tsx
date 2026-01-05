"use client";

import * as React from "react";

import { AdminSidebar } from "~/components/admin/AdminSidebar";
import { Separator } from "~/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";

export function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-theme dark min-h-svh bg-background text-foreground">
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset className="min-h-svh">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <div className="text-sm font-medium">Admin</div>
          </header>
          <div className="flex flex-1 flex-col p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
