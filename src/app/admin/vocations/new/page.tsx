import React from "react";
import Link from "next/link";
import { prisma } from "~/lib/prisma";
import { VocationalResourceForm } from "~/components/admin/vocations/VocationalResourceForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminNewVocationResourcePage() {
  const items = await prisma.item.findMany({
    select: { id: true, name: true, itemType: true },
    orderBy: [{ name: "asc" }],
    take: 1000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">New Vocational Resource</h1>
          <p className="text-sm text-white/70">Create an output resource and define its inputs (requirements).</p>
        </div>
        <Link href="/admin/vocations" className="text-sm text-white/70 hover:text-white">
          Back
        </Link>
      </div>

      <div className="rounded-lg border border-gray-800/60 bg-gray-900/20 p-6">
        <VocationalResourceForm mode="create" items={items} />
      </div>
    </div>
  );
}
