function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function resolveRegeneratedHealth(params: {
  currentHealth: number;
  maxHealth: number;
  healthRegen: number;
  regeneratedAt: Date;
  now: Date;
}) {
  const maxHealth = Math.max(1, params.maxHealth);
  const elapsedSeconds = Math.max(
    0,
    (params.now.getTime() - params.regeneratedAt.getTime()) / 1_000,
  );
  const regenerated =
    Math.max(0, params.currentHealth) +
    elapsedSeconds * Math.max(0, params.healthRegen);
  return Math.round(clamp(regenerated, 0, maxHealth) * 1_000) / 1_000;
}

export function calculateHealthAfterDamage(params: {
  currentHealth: number;
  maxHealth: number;
  requestedDamage: number;
  minimumRemainingHealthPercent: number;
}) {
  const maxHealth = Math.max(1, params.maxHealth);
  const currentHealth = clamp(params.currentHealth, 0, maxHealth);
  // Hunting is non-lethal even when an admin chooses a zero-percent floor.
  const floor = clamp(
    maxHealth * (params.minimumRemainingHealthPercent / 100),
    1,
    maxHealth,
  );
  const appliedDamage = Math.min(
    Math.max(0, params.requestedDamage),
    Math.max(0, currentHealth - floor),
  );
  return {
    currentHealth: Math.round((currentHealth - appliedDamage) * 1_000) / 1_000,
    appliedDamage: Math.round(appliedDamage * 1_000) / 1_000,
    floor: Math.round(floor * 1_000) / 1_000,
  };
}
