"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

const schema = z.object({
  name: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export function LocationForm(props: {
  mode: "create" | "edit";
  locationId?: number;
  initialValues?: Partial<FormValues>;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      ...props.initialValues,
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true);
    try {
      const res = await fetch(
        props.mode === "create" ? "/api/admin/locations" : `/api/admin/locations/${props.locationId}`,
        {
          method: props.mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        alert(json?.error ?? "Failed to save");
        return;
      }

      router.push("/admin/locations");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async () => {
    if (!props.locationId) return;
    if (!confirm("Delete this location?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/locations/${props.locationId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        alert(json?.error ?? "Failed to delete");
        return;
      }

      router.push("/admin/locations");
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm text-white/80">Name</div>
        <Input {...form.register("name")} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : props.mode === "create" ? "Create" : "Save"}
        </Button>

        {props.mode === "edit" ? (
          <Button type="button" variant="destructive" disabled={isDeleting} onClick={onDelete}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
