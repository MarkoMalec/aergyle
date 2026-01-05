import React from "react";
import Link from "next/link";
import { LocationForm } from "~/components/admin/locations/LocationForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminNewLocationPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">New Location</h1>
          <p className="text-sm text-white/70">Create a location first, then assign resources.</p>
        </div>
        <Link href="/admin/locations" className="text-sm text-white/70 hover:text-white">
          Back
        </Link>
      </div>

      <div className="rounded-lg border border-gray-800/60 bg-gray-900/20 p-6">
        <LocationForm mode="create" />
      </div>
    </div>
  );
}
