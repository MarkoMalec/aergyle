import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateMarketSale,
  estimateSellNow,
  percentageChange,
  weightedAveragePrice,
  weightedMedianPrice,
} from "../src/lib/marketplace";

void test("market tax and seller proceeds are calculated from the full quantity", () => {
  assert.deepEqual(calculateMarketSale(12.5, 8), {
    gross: 100,
    tax: 12,
    net: 88,
  });
});

void test("sell now consumes the highest bids first and reports unfilled quantity", () => {
  assert.deepEqual(
    estimateSellNow(
      [
        { price: 10, quantity: 2 },
        { price: 8, quantity: 3 },
      ],
      7,
    ),
    {
      filledQuantity: 5,
      unfilledQuantity: 2,
      gross: 44,
      tax: 5.28,
      net: 38.72,
      averagePrice: 8.8,
    },
  );
});

void test("sell now keeps per-order tax rounding exact", () => {
  assert.deepEqual(
    estimateSellNow(
      [
        { price: 0.05, quantity: 1 },
        { price: 0.05, quantity: 1 },
      ],
      2,
    ),
    {
      filledQuantity: 2,
      unfilledQuantity: 0,
      gross: 0.1,
      tax: 0.02,
      net: 0.08,
      averagePrice: 0.05,
    },
  );
});

void test("completed-sale metrics are weighted by units instead of listing count", () => {
  const samples = [
    { unitPrice: 5, quantity: 9 },
    { unitPrice: 50, quantity: 1 },
  ];
  assert.equal(weightedAveragePrice(samples), 9.5);
  assert.equal(weightedMedianPrice(samples), 5);
});

void test("price change is absent without a trustworthy comparison window", () => {
  assert.equal(percentageChange(12, null), null);
  assert.equal(percentageChange(12, 0), null);
  assert.equal(percentageChange(12, 10), 20);
});
