"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

const schema = z.object({
  skill_name: z.string().min(1),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function SkillForm(props: {
  mode: "create" | "edit";
  skillId?: number;
  initialValues?: Partial<FormValues>;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const defaults: FormValues = {
    skill_name: "",
    description: "",
    ...props.initialValues,
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const onSubmit = async (values: FormValues) => {
    setIsSaving(true);
    try {
      const res = await fetch(
        props.mode === "create" ? "/api/admin/skills" : `/api/admin/skills/${props.skillId}`,
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

      router.push("/admin/skills");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = async () => {
    if (!props.skillId) return;
    if (!confirm("Delete this skill?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/skills/${props.skillId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        alert(json?.error ?? "Failed to delete");
        return;
      }

      router.push("/admin/skills");
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm text-white/80">Name</div>
          <Input {...form.register("skill_name")} />
        </div>
        <div className="space-y-2">
          <div className="text-sm text-white/80">Description</div>
          <Input placeholder="Optional" {...form.register("description")} />
          <div className="text-xs text-white/50">Longer descriptions can be added later with a textarea.</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : props.mode === "create" ? "Create" : "Save"}
        </Button>

        {props.mode === "edit" ? (
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={onDelete}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
