/** Names of the fields whose stored value differs from what the seed expects. */
export function changedFields(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
) {
  return Object.entries(expected)
    .filter(([key, value]) => actual[key] !== value)
    .map(([key]) => key);
}

/** Whether a recipe already has exactly the expected inputs and quantities. */
export function sameRequirements(
  actual: ReadonlyArray<{ itemId: number; quantityPerUnit: number }>,
  expected: ReadonlyArray<{ itemId: number; quantityPerUnit: number }>,
) {
  const quantities = new Map(
    actual.map((requirement) => [
      requirement.itemId,
      requirement.quantityPerUnit,
    ]),
  );
  return (
    quantities.size === expected.length &&
    expected.every(
      (requirement) =>
        quantities.get(requirement.itemId) === requirement.quantityPerUnit,
    )
  );
}
