import { describe, expect, it } from "vitest";
import {
  buildXlsxBinary,
  computeProjections,
  defaultDebt,
  defaultFundingShock,
  defaultOverrides,
  defaultSavingsPipeline,
  initialState,
  validateConfig,
} from "./mtfs.js";

const baseline = initialState.baseline;

const round = (value) => Math.round(value);

describe("MTFS projections", () => {
  it("computes year 1 net budget requirement deterministically", () => {
    const [year1] = computeProjections(
      baseline,
      defaultOverrides,
      defaultFundingShock,
      defaultDebt,
      initialState,
      defaultSavingsPipeline
    );
    const payPriceInflation =
      initialState.previousYearBase *
      ((baseline.payAward + baseline.generalInflation) / 100);
    const debtCost =
      defaultDebt.debtPrincipal * (defaultDebt.debtInterestRate / 100) +
      defaultDebt.annualCapitalFinancing;
    const expected =
      initialState.previousYearBase +
      payPriceInflation +
      initialState.demandPressures +
      debtCost -
      (initialState.plannedSavings + defaultSavingsPipeline[0].amount * defaultSavingsPipeline[0].confidence +
        defaultSavingsPipeline[2].amount * defaultSavingsPipeline[2].confidence);
    expect(round(year1.netBudgetRequirement)).toBe(round(expected));
  });

  it("reduces reserves by cumulative gap", () => {
    const projections = computeProjections(
      baseline,
      defaultOverrides,
      defaultFundingShock,
      defaultDebt,
      initialState,
      defaultSavingsPipeline
    );
    const cumulativeGap = projections.reduce(
      (acc, row) => acc + row.annualGap,
      0
    );
    const expected = initialState.currentReserves - cumulativeGap;
    expect(round(projections[4].reservesEnd)).toBe(round(expected));
  });

  it("applies funding shock to total funding", () => {
    const shock = { enabled: true, yearIndex: 0, amount: -10_000_000 };
    const [year1] = computeProjections(
      baseline,
      defaultOverrides,
      shock,
      defaultDebt,
      initialState,
      defaultSavingsPipeline
    );
    const [baseYear1] = computeProjections(
      baseline,
      defaultOverrides,
      defaultFundingShock,
      defaultDebt,
      initialState,
      defaultSavingsPipeline
    );
    expect(round(year1.totalFunding)).toBe(
      round(baseYear1.totalFunding + shock.amount)
    );
  });
});

describe("Exports", () => {
  it("builds an XLSX zip binary", () => {
    const projections = computeProjections(
      baseline,
      defaultOverrides,
      defaultFundingShock,
      defaultDebt,
      initialState,
      defaultSavingsPipeline
    );
    const binary = buildXlsxBinary(projections);
    expect(binary instanceof Uint8Array).toBe(true);
    expect(binary.length).toBeGreaterThan(100);
  });
});

describe("Config validation", () => {
  it("accepts valid config objects", () => {
    const result = validateConfig({ inputs: {}, assumptions: {} });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid config objects", () => {
    const result = validateConfig("bad");
    expect(result.valid).toBe(false);
  });
});
