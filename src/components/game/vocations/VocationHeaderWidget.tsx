"use client";

import React from "react";
import ActiveActionHeaderWidget from "~/components/game/actions/ActiveActionHeaderWidget";

// Backwards-compat wrapper (old name), kept to avoid breaking imports.
export default function VocationHeaderWidget() {
  return <ActiveActionHeaderWidget />;
}
