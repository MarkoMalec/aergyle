export function getLocationRequiredLevel(location: {
  requiredLevel?: number | null;
}) {
  return Math.max(1, Math.floor(location.requiredLevel ?? 1));
}

export function meetsLocationLevelRequirement(
  location: { requiredLevel?: number | null },
  userLevel: number,
) {
  return (
    Number.isFinite(userLevel) &&
    Math.floor(userLevel) >= getLocationRequiredLevel(location)
  );
}
