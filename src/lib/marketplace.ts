export const MARKET_TAX_RATE = 0.12;
export const MARKET_TAX_PERCENT = MARKET_TAX_RATE * 100;
export const MARKET_DEFAULT_MAX_PRICE = 100_000;
export const MARKET_MAX_GOLD_AMOUNT = 99_999_999.99;
export const MARKET_MAX_OPEN_BUY_ORDERS = 50;

export function roundGold(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateMarketSale(unitPrice: number, quantity: number) {
  const gross = roundGold(unitPrice * quantity);
  const tax = roundGold(gross * MARKET_TAX_RATE);
  const net = roundGold(gross - tax);

  return { gross, tax, net };
}

export function parsePositiveGold(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;

  const rounded = roundGold(parsed);
  return rounded > 0 ? rounded : null;
}

export function formatGold(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export type BuyOrderLevel = {
  price: number;
  quantity: number;
};

export type MarketPriceSample = {
  unitPrice: number;
  quantity: number;
};

export function estimateSellNow(
  levels: readonly BuyOrderLevel[],
  requestedQuantity: number,
) {
  let remaining = Math.max(0, Math.floor(requestedQuantity));
  let filledQuantity = 0;
  let gross = 0;
  let tax = 0;

  for (const level of levels) {
    if (remaining <= 0) break;
    const available = Math.max(0, Math.floor(level.quantity));
    const fill = Math.min(remaining, available);
    if (fill <= 0) continue;

    filledQuantity += fill;
    const levelSale = calculateMarketSale(level.price, fill);
    gross += levelSale.gross;
    tax += levelSale.tax;
    remaining -= fill;
  }

  const roundedGross = roundGold(gross);
  const roundedTax = roundGold(tax);

  return {
    filledQuantity,
    unfilledQuantity: Math.max(0, requestedQuantity - filledQuantity),
    gross: roundedGross,
    tax: roundedTax,
    net: roundGold(roundedGross - roundedTax),
    averagePrice:
      filledQuantity > 0 ? roundGold(roundedGross / filledQuantity) : 0,
  };
}

export function weightedAveragePrice(
  samples: readonly MarketPriceSample[],
): number | null {
  const totals = samples.reduce(
    (result, sample) => {
      const quantity = Math.max(0, Math.floor(sample.quantity));
      return {
        quantity: result.quantity + quantity,
        value: result.value + sample.unitPrice * quantity,
      };
    },
    { quantity: 0, value: 0 },
  );

  return totals.quantity > 0 ? roundGold(totals.value / totals.quantity) : null;
}

export function weightedMedianPrice(
  samples: readonly MarketPriceSample[],
): number | null {
  const sorted = samples
    .map((sample) => ({
      unitPrice: sample.unitPrice,
      quantity: Math.max(0, Math.floor(sample.quantity)),
    }))
    .filter((sample) => sample.quantity > 0)
    .sort((a, b) => a.unitPrice - b.unitPrice);
  const totalQuantity = sorted.reduce(
    (sum, sample) => sum + sample.quantity,
    0,
  );
  if (totalQuantity === 0) return null;

  const midpoint = totalQuantity / 2;
  let cumulative = 0;
  for (const sample of sorted) {
    cumulative += sample.quantity;
    if (cumulative >= midpoint) return roundGold(sample.unitPrice);
  }

  return null;
}

export function percentageChange(
  current: number | null,
  previous: number | null,
): number | null {
  if (current == null || previous == null || previous === 0) return null;
  return roundGold(((current - previous) / previous) * 100);
}
