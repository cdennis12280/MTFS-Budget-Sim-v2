import { zipSync, strToU8 } from "fflate";

export const initialState = {
  baseYear: 2026,
  previousYearBase: 200_000_000,
  plannedSavings: 10_000_000,
  demandPressures: 14_000_000,
  currentReserves: 45_000_000,
  taxBase: 120_000,
  averageBandD: 1_850,
  businessRates: 62_000_000,
  revenueSupportGrant: 18_000_000,
  otherGrants: 26_000_000,
  fundingGrowth: {
    businessRates: 0.8,
    revenueSupportGrant: -1.8,
    otherGrants: 0.4,
  },
  serviceSplits: {
    Adults: 0.45,
    Children: 0.3,
    Housing: 0.25,
  },
  serviceAssumptions: {
    Adults: { inflationAdj: 0.8, demandAdj: 1.5 },
    Children: { inflationAdj: 0.4, demandAdj: 1.0 },
    Housing: { inflationAdj: 0.2, demandAdj: 0.6 },
  },
  baseline: {
    councilTaxIncrease: 3.0,
    payAward: 4.0,
    generalInflation: 3.0,
    socialCareGrowth: 4.5,
  },
};

export const scenarioPresets = {
  Base: {
    councilTaxIncrease: 3.0,
    payAward: 4.0,
    generalInflation: 3.0,
    socialCareGrowth: 4.5,
  },
  Optimistic: {
    councilTaxIncrease: 5.0,
    payAward: 2.5,
    generalInflation: 2.0,
    socialCareGrowth: 2.5,
  },
  Pessimistic: {
    councilTaxIncrease: 1.0,
    payAward: 6.5,
    generalInflation: 5.5,
    socialCareGrowth: 7.0,
  },
};

export const defaultOverrides = Array.from({ length: 5 }, () => ({
  enabled: false,
  councilTaxIncrease: null,
  payAward: null,
  generalInflation: null,
  socialCareGrowth: null,
}));

export const defaultFundingShock = {
  enabled: false,
  yearIndex: 0,
  amount: -5_000_000,
};

export const defaultDebt = {
  debtPrincipal: 120_000_000,
  debtInterestRate: 4.2,
  annualCapitalFinancing: 6_500_000,
};

export const defaultSavingsPipeline = [
  {
    name: "Digital channel shift",
    amount: 2_000_000,
    startYear: 1,
    recurring: true,
    confidence: 0.7,
  },
  {
    name: "Commissioning re-tender",
    amount: 3_500_000,
    startYear: 2,
    recurring: true,
    confidence: 0.55,
  },
  {
    name: "Asset rationalisation",
    amount: 4_000_000,
    startYear: 1,
    recurring: false,
    confidence: 0.5,
  },
];

export const defaultStress = {
  seed: 12345,
  simulations: 200,
  inflationSigma: 0.8,
  demandSigma: 1.2,
  paySigma: 0.7,
  ctSigma: 0.6,
};

export const money = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);

export const percent = (value) => `${value.toFixed(1)}%`;

export const buildCSV = (rows) => {
  const headers = [
    "Year",
    "Net Budget Requirement",
    "Total Funding",
    "Annual Gap",
    "Reserves End",
  ];
  const lines = rows.map((row) =>
    [
      row.year,
      row.netBudgetRequirement,
      row.totalFunding,
      row.annualGap,
      row.reservesEnd,
    ].join(",")
  );
  return [headers.join(","), ...lines].join("\n");
};

export const buildXlsxBinary = (rows, meta = null) => {
  const projectionRows = [
    [
      "Year",
      "Net Budget Requirement",
      "Total Funding",
      "Annual Gap",
      "Reserves End",
    ],
    ...rows.map((row) => [
      row.year,
      row.netBudgetRequirement,
      row.totalFunding,
      row.annualGap,
      row.reservesEnd,
    ]),
  ];

  const sheets = [{ name: "Projections", rows: projectionRows }];

  if (meta) {
    sheets.push({
      name: "Scenario",
      rows: [
        ["Scenario Summary"],
        ["Scenario", meta.scenario ?? ""],
        ["Generated", meta.timestamp ?? ""],
        ["Council Tax %", meta.inputs?.councilTaxIncrease ?? ""],
        ["Pay Award %", meta.inputs?.payAward ?? ""],
        ["Inflation %", meta.inputs?.generalInflation ?? ""],
        ["Demand %", meta.inputs?.socialCareGrowth ?? ""],
      ],
    });
    sheets.push({
      name: "Assumptions",
      rows: [
        ["Core Assumptions"],
        ["Previous Year Base", meta.assumptions?.previousYearBase ?? ""],
        ["Demand Pressures", meta.assumptions?.demandPressures ?? ""],
        ["Planned Savings", meta.assumptions?.plannedSavings ?? ""],
        ["Current Reserves", meta.assumptions?.currentReserves ?? ""],
        ["Tax Base", meta.assumptions?.taxBase ?? ""],
        ["Average Band D", meta.assumptions?.averageBandD ?? ""],
        ["Business Rates", meta.assumptions?.businessRates ?? ""],
        ["Revenue Support Grant", meta.assumptions?.revenueSupportGrant ?? ""],
        ["Other Grants", meta.assumptions?.otherGrants ?? ""],
        [],
        ["Funding Shock"],
        ["Enabled", meta.fundingShock?.enabled ? "Yes" : "No"],
        ["Year Index", meta.fundingShock?.yearIndex ?? ""],
        ["Amount", meta.fundingShock?.amount ?? ""],
        [],
        ["Debt & Capital Financing"],
        ["Debt Principal", meta.debt?.debtPrincipal ?? ""],
        ["Debt Interest Rate", meta.debt?.debtInterestRate ?? ""],
        ["Annual Capital Financing", meta.debt?.annualCapitalFinancing ?? ""],
      ],
    });
    sheets.push({
      name: "Savings",
      rows: [
        ["Savings Pipeline"],
        ["Name", "Amount", "Start Year", "Recurring", "Confidence"],
        ...(meta.pipeline ?? []).map((item) => [
          item.name ?? "",
          item.amount ?? "",
          item.startYear ?? "",
          item.recurring ? "Yes" : "No",
          item.confidence ?? "",
        ]),
      ],
    });
    sheets.push({
      name: "Overrides",
      rows: [
        ["Per-Year Overrides"],
        ["Year", "Enabled", "CT %", "Pay %", "Inflation %", "Demand %"],
        ...(meta.overrides ?? []).map((item, idx) => [
          `Y${idx + 1}`,
          item.enabled ? "Yes" : "No",
          item.councilTaxIncrease ?? "",
          item.payAward ?? "",
          item.generalInflation ?? "",
          item.socialCareGrowth ?? "",
        ]),
      ],
    });
    sheets.push({
      name: "Governance",
      rows: [
        ["Governance Notes"],
        ...(meta.governanceNotes ?? []).map((note, idx) => [
          `Y${idx + 1}`,
          note ?? "",
        ]),
      ],
    });
    sheets.push({
      name: "Stress",
      rows: [
        ["Stress Test"],
        ["Simulations", meta.stress?.simulations ?? ""],
        ["Seed", meta.stress?.seed ?? ""],
      ],
    });
  }

  const escapeXml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const colLetter = (index) => {
    let col = "";
    let n = index + 1;
    while (n > 0) {
      const rem = (n - 1) % 26;
      col = String.fromCharCode(65 + rem) + col;
      n = Math.floor((n - 1) / 26);
    }
    return col;
  };

  const buildSheetXml = (sheetRows) =>
    sheetRows
      .map((row, rowIndex) => {
        const cells = row
          .map((value, colIndex) => {
            const ref = `${colLetter(colIndex)}${rowIndex + 1}`;
            if (typeof value === "number") {
              return `<c r="${ref}"><v>${value}</v></c>`;
            }
            return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(
              value
            )}</t></is></c>`;
          })
          .join("");
        return `<row r="${rowIndex + 1}">${cells}</row>`;
      })
      .join("");

  const sheetEntries = sheets.map((sheet, index) => ({
    index,
    name: sheet.name,
    xml:
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetData>${buildSheetXml(sheet.rows)}</sheetData></worksheet>`,
  }));

  const workbookSheets = sheetEntries
    .map(
      (sheet) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${sheet.index + 1}" r:id="rId${sheet.index + 1}"/>`
    )
    .join("");

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${workbookSheets}</sheets></workbook>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheetEntries
      .map(
        (sheet) =>
          `<Relationship Id="rId${sheet.index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheet.index + 1}.xml"/>`
      )
      .join("") +
    `</Relationships>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    sheetEntries
      .map(
        (sheet) =>
          `<Override PartName="/xl/worksheets/sheet${sheet.index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join("") +
    `</Types>`;

  const zipEntries = {
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rels),
    "xl/workbook.xml": strToU8(workbook),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRels),
  };

  sheetEntries.forEach((sheet) => {
    zipEntries[`xl/worksheets/sheet${sheet.index + 1}.xml`] = strToU8(sheet.xml);
  });

  return zipSync(zipEntries);
};

export const ragStatus = (reserves, budget) => {
  if (reserves <= 0) {
    return { label: "Red", tone: "bg-rose-600", message: "Reserves exhausted" };
  }
  const ratio = reserves / budget;
  if (ratio > 0.05) {
    return { label: "Green", tone: "bg-emerald-500", message: "Healthy buffer" };
  }
  if (ratio >= 0.01) {
    return { label: "Amber", tone: "bg-amber-400", message: "Tight headroom" };
  }
  return { label: "Red", tone: "bg-rose-600", message: "Critical" };
};

const resolveInputsForYear = (inputs, overrides, index) => {
  const override = overrides?.[index];
  if (!override || !override.enabled) return inputs;
  return {
    councilTaxIncrease:
      override.councilTaxIncrease ?? inputs.councilTaxIncrease,
    payAward: override.payAward ?? inputs.payAward,
    generalInflation: override.generalInflation ?? inputs.generalInflation,
    socialCareGrowth: override.socialCareGrowth ?? inputs.socialCareGrowth,
  };
};

const calcPipelineSavings = (pipeline, yearIndex) =>
  (pipeline ?? []).reduce((sum, item) => {
    if (item.startYear > yearIndex + 1) return sum;
    if (!item.recurring && item.startYear !== yearIndex + 1) return sum;
    return sum + item.amount * (item.confidence ?? 1);
  }, 0);

export const computeProjections = (
  inputs,
  overrides,
  fundingShock,
  debt,
  assumptions = initialState,
  pipeline = defaultSavingsPipeline
) => {
  const rows = [];
  let previousBase = assumptions.previousYearBase;
  let cumulativeGap = 0;

  for (let i = 0; i < 5; i += 1) {
    const yearInputs = resolveInputsForYear(inputs, overrides, i);
    const year = assumptions.baseYear + i + 1;
    const payPriceInflation =
      previousBase * ((yearInputs.payAward + yearInputs.generalInflation) / 100);
    const demandPressures =
      assumptions.demandPressures *
      Math.pow(1 + yearInputs.socialCareGrowth / 100, i);
    const baseSavings = assumptions.plannedSavings;
    const pipelineSavings = calcPipelineSavings(pipeline, i);
    const plannedSavings = baseSavings + pipelineSavings;
    const debtCost =
      (debt?.debtPrincipal ?? 0) * ((debt?.debtInterestRate ?? 0) / 100) +
      (debt?.annualCapitalFinancing ?? 0);

    const netBudgetRequirement =
      previousBase +
      payPriceInflation +
      demandPressures +
      debtCost -
      plannedSavings;

    const councilTaxRevenue =
      assumptions.taxBase *
      assumptions.averageBandD *
      Math.pow(1 + yearInputs.councilTaxIncrease / 100, i + 1);

    const businessRates =
      assumptions.businessRates *
      Math.pow(1 + assumptions.fundingGrowth.businessRates / 100, i);
    const revenueSupportGrant =
      assumptions.revenueSupportGrant *
      Math.pow(1 + assumptions.fundingGrowth.revenueSupportGrant / 100, i);
    const otherGrants =
      assumptions.otherGrants *
      Math.pow(1 + assumptions.fundingGrowth.otherGrants / 100, i);

    const baseFunding =
      councilTaxRevenue + businessRates + revenueSupportGrant + otherGrants;

    const shockAmount =
      fundingShock?.enabled && fundingShock.yearIndex === i
        ? fundingShock.amount
        : 0;

    const totalFunding = baseFunding + shockAmount;
    const annualGap = netBudgetRequirement - totalFunding;
    cumulativeGap += annualGap;
    const reservesEnd = assumptions.currentReserves - cumulativeGap;

    rows.push({
      year: `Y${i + 1} (${year})`,
      netBudgetRequirement,
      totalFunding,
      annualGap,
      reservesEnd,
      payPriceInflation,
      demandPressures,
      plannedSavings,
      pipelineSavings,
      councilTaxRevenue,
      businessRates,
      revenueSupportGrant,
      otherGrants,
      debtCost,
      shockAmount,
    });

    previousBase = netBudgetRequirement;
  }

  return rows;
};

export const computeWaterfall = (rows, assumptions = initialState) => {
  const year1 = rows[0];
  if (!year1) return [];
  return [
    { label: "Base", value: assumptions.previousYearBase },
    { label: "Pay+Infl", value: year1.payPriceInflation },
    { label: "Demand", value: year1.demandPressures },
    { label: "Debt", value: year1.debtCost },
    { label: "Savings", value: -year1.plannedSavings },
    { label: "Funding", value: -year1.totalFunding },
    { label: "Gap", value: year1.annualGap },
  ];
};

export const computeServiceBreakdown = (rows, assumptions = initialState) => {
  const services = Object.keys(assumptions.serviceSplits);
  return services.reduce((acc, service) => {
    const split = assumptions.serviceSplits[service];
    const adjustments = assumptions.serviceAssumptions[service] || {
      inflationAdj: 0,
      demandAdj: 0,
    };
    const factor = 1 + (adjustments.inflationAdj + adjustments.demandAdj) / 100;
    acc[service] = rows.map((row) => ({
      year: row.year,
      service,
      requirement: row.netBudgetRequirement * split * factor,
      gapShare: row.annualGap * split * factor,
    }));
    return acc;
  }, {});
};

export const findReserveExhaustion = (rows) =>
  rows.find((row) => row.reservesEnd <= 0);

export const computeSensitivity = (
  inputs,
  overrides,
  fundingShock,
  debt,
  assumptions = initialState,
  pipeline = defaultSavingsPipeline
) => {
  const drivers = [
    { key: "councilTaxIncrease", label: "Council Tax %" },
    { key: "payAward", label: "Pay Award %" },
    { key: "generalInflation", label: "General Inflation %" },
    { key: "socialCareGrowth", label: "Demand Growth %" },
  ];
  const baseline = computeProjections(
    inputs,
    overrides,
    fundingShock,
    debt,
    assumptions,
    pipeline
  )[0]?.annualGap;
  return drivers.map((driver) => {
    const upInputs = { ...inputs, [driver.key]: inputs[driver.key] + 1 };
    const downInputs = { ...inputs, [driver.key]: inputs[driver.key] - 1 };
    const upGap = computeProjections(
      upInputs,
      overrides,
      fundingShock,
      debt,
      assumptions,
      pipeline
    )[0]?.annualGap;
    const downGap = computeProjections(
      downInputs,
      overrides,
      fundingShock,
      debt,
      assumptions,
      pipeline
    )[0]?.annualGap;
    return {
      driver: driver.label,
      up: (upGap ?? 0) - (baseline ?? 0),
      down: (baseline ?? 0) - (downGap ?? 0),
    };
  });
};

export const solveCouncilTaxIncrease = (
  inputs,
  overrides,
  fundingShock,
  debt,
  assumptions,
  pipeline
) => {
  let low = 0;
  let high = 5;
  let best = null;
  for (let i = 0; i < 20; i += 1) {
    const mid = (low + high) / 2;
    const testInputs = { ...inputs, councilTaxIncrease: mid };
    const gap = computeProjections(
      testInputs,
      overrides,
      fundingShock,
      debt,
      assumptions,
      pipeline
    )[0]?.annualGap;
    if (gap === undefined) return null;
    if (gap > 0) {
      low = mid;
    } else {
      high = mid;
      best = mid;
    }
  }
  return best;
};

export const solveAdditionalSavings = (projections) => {
  const year1 = projections[0];
  if (!year1) return 0;
  return year1.annualGap > 0 ? year1.annualGap : 0;
};

const mulberry32 = (seed) => {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const normalish = (rand) => {
  const u = rand() || 1e-9;
  const v = rand() || 1e-9;
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export const computeStressTest = (
  inputs,
  overrides,
  fundingShock,
  debt,
  assumptions,
  pipeline,
  stress
) => {
  const rand = mulberry32(stress.seed);
  const results = [];

  for (let i = 0; i < stress.simulations; i += 1) {
    const tweak = {
      councilTaxIncrease: inputs.councilTaxIncrease +
        normalish(rand) * stress.ctSigma,
      payAward: inputs.payAward + normalish(rand) * stress.paySigma,
      generalInflation:
        inputs.generalInflation + normalish(rand) * stress.inflationSigma,
      socialCareGrowth:
        inputs.socialCareGrowth + normalish(rand) * stress.demandSigma,
    };
    const sim = computeProjections(
      tweak,
      overrides,
      fundingShock,
      debt,
      assumptions,
      pipeline
    );
    results.push({
      year1Gap: sim[0]?.annualGap ?? 0,
      year5Reserves: sim[4]?.reservesEnd ?? 0,
    });
  }

  const sortedGap = results.map((r) => r.year1Gap).sort((a, b) => a - b);
  const sortedRes = results
    .map((r) => r.year5Reserves)
    .sort((a, b) => a - b);

  const pick = (arr, p) => arr[Math.floor(p * (arr.length - 1))];

  return {
    p10Gap: pick(sortedGap, 0.1),
    p50Gap: pick(sortedGap, 0.5),
    p90Gap: pick(sortedGap, 0.9),
    p10Reserves: pick(sortedRes, 0.1),
    p50Reserves: pick(sortedRes, 0.5),
    p90Reserves: pick(sortedRes, 0.9),
  };
};

export const validateConfig = (data) => {
  if (!data || typeof data !== "object") return { valid: false };
  if (data.assumptions && typeof data.assumptions !== "object") {
    return { valid: false };
  }
  if (data.inputs && typeof data.inputs !== "object") {
    return { valid: false };
  }
  return { valid: true };
};
