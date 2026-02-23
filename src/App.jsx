import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  BadgeInfo,
  BarChart3,
  ClipboardCopy,
  FileDown,
  FileText,
  FolderOpen,
  LineChart as LineChartIcon,
  Printer,
  Save,
  Settings2,
  ShieldAlert,
  Waves,
} from "lucide-react";
import {
  buildCSV,
  buildXlsxBinary,
  computeProjections,
  computeSensitivity,
  computeServiceBreakdown,
  computeStressTest,
  computeWaterfall,
  defaultDebt,
  defaultFundingShock,
  defaultOverrides,
  defaultSavingsPipeline,
  defaultStress,
  findReserveExhaustion,
  initialState,
  money,
  percent,
  ragStatus,
  scenarioPresets,
  solveAdditionalSavings,
  solveCouncilTaxIncrease,
  validateConfig,
} from "./lib/mtfs.js";

const storageKey = "mtfs_scenarios_v3";
const notesKey = "mtfs_governance_notes_v1";
const printableMetaKey = "mtfs_print_meta";
const auditKey = "mtfs_audit_trail_v1";

const tooltipLabel = (text) => (
  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
    <BadgeInfo className="h-3.5 w-3.5" />
    {text}
  </span>
);

const defaultNotes = Array.from({ length: 5 }, () => "");
const formatNumber = (value) =>
  new Intl.NumberFormat("en-GB").format(Number.isFinite(value) ? value : 0);
const parseNumber = (value) =>
  Number(String(value).replace(/,/g, "").trim() || 0);

export default function App() {
  const [scenario, setScenario] = useState("Base");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState("Dashboard");
  const [assumptions, setAssumptions] = useState(initialState);
  const [serviceTab, setServiceTab] = useState(
    Object.keys(initialState.serviceSplits)[0]
  );
  const [inputs, setInputs] = useState(initialState.baseline);
  const [overrides, setOverrides] = useState(defaultOverrides);
  const [fundingShock, setFundingShock] = useState(defaultFundingShock);
  const [debt, setDebt] = useState(defaultDebt);
  const [pipeline, setPipeline] = useState(defaultSavingsPipeline);
  const [stress, setStress] = useState(defaultStress);
  const [scenarioName, setScenarioName] = useState("");
  const [savedScenarios, setSavedScenarios] = useState(() => {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  });
  const [governanceNotes, setGovernanceNotes] = useState(() => {
    const raw = localStorage.getItem(notesKey);
    return raw ? JSON.parse(raw) : defaultNotes;
  });
  const [auditTrail, setAuditTrail] = useState(() => {
    const raw = localStorage.getItem(auditKey);
    return raw ? JSON.parse(raw) : [];
  });
  const lastSnapshot = useRef("");

  useEffect(() => {
    const services = Object.keys(assumptions.serviceSplits);
    if (!services.includes(serviceTab)) {
      setServiceTab(services[0]);
    }
  }, [assumptions, serviceTab]);

  useEffect(() => {
    const snapshot = JSON.stringify({
      inputs,
      overrides,
      fundingShock,
      debt,
      assumptions,
      pipeline,
    });
    if (lastSnapshot.current && lastSnapshot.current === snapshot) return;
    lastSnapshot.current = snapshot;
    const entry = {
      timestamp: new Date().toISOString(),
      scenario,
      summary: `CT ${inputs.councilTaxIncrease}% | Pay ${inputs.payAward}% | Infl ${inputs.generalInflation}% | Demand ${inputs.socialCareGrowth}%`,
    };
    const updated = [entry, ...auditTrail].slice(0, 200);
    setAuditTrail(updated);
    localStorage.setItem(auditKey, JSON.stringify(updated));
  }, [inputs, overrides, fundingShock, debt, assumptions, pipeline, scenario]);

  const handleScenario = (value) => {
    setScenario(value);
    setInputs(scenarioPresets[value]);
  };

  const baselineInputs = assumptions.baseline ?? initialState.baseline;
  const projections = useMemo(
    () =>
      computeProjections(
        inputs,
        overrides,
        fundingShock,
        debt,
        assumptions,
        pipeline
      ),
    [inputs, overrides, fundingShock, debt, assumptions, pipeline]
  );
  const baselineProjections = useMemo(
    () =>
      computeProjections(
        baselineInputs,
        defaultOverrides,
        defaultFundingShock,
        defaultDebt,
        assumptions,
        pipeline
      ),
    [assumptions, baselineInputs, pipeline]
  );

  const rag = ragStatus(
    projections[0]?.reservesEnd ?? assumptions.currentReserves,
    projections[0]?.netBudgetRequirement ?? assumptions.previousYearBase
  );

  const waterfallData = useMemo(
    () => computeWaterfall(projections, assumptions),
    [projections, assumptions]
  );
  const reservesSeries = projections.map((row) => ({
    year: row.year,
    reserves: row.reservesEnd,
  }));
  const serviceBreakdown = useMemo(
    () => computeServiceBreakdown(projections, assumptions),
    [projections, assumptions]
  );
  const exhaustion = findReserveExhaustion(projections);
  const sensitivity = useMemo(
    () =>
      computeSensitivity(
        inputs,
        overrides,
        fundingShock,
        debt,
        assumptions,
        pipeline
      ),
    [inputs, overrides, fundingShock, debt, assumptions, pipeline]
  );
  const stressSummary = useMemo(
    () =>
      computeStressTest(
        inputs,
        overrides,
        fundingShock,
        debt,
        assumptions,
        pipeline,
        stress
      ),
    [inputs, overrides, fundingShock, debt, assumptions, pipeline, stress]
  );

  const deltaGap =
    (projections[0]?.annualGap ?? 0) - (baselineProjections[0]?.annualGap ?? 0);
  const deltaReserves =
    (projections[4]?.reservesEnd ?? 0) -
    (baselineProjections[4]?.reservesEnd ?? 0);
  const year5Gap = projections[4]?.annualGap ?? 0;
  const triggerLevel = projections[0]?.netBudgetRequirement
    ? projections[0].netBudgetRequirement * 0.05
    : 0;
  const triggerBreached = projections.some(
    (row) => row.reservesEnd < triggerLevel
  );

  const solverCT = solveCouncilTaxIncrease(
    inputs,
    overrides,
    fundingShock,
    debt,
    assumptions,
    pipeline
  );
  const solverSavings = solveAdditionalSavings(projections);

  const copyCSV = async () => {
    const csv = buildCSV(projections);
    await navigator.clipboard.writeText(csv);
  };

  const exportXLSX = () => {
    const binary = buildXlsxBinary(projections, {
      scenario,
      timestamp: new Date().toISOString(),
      inputs,
      assumptions,
      fundingShock,
      debt,
      overrides,
      pipeline,
      stress,
      governanceNotes,
    });
    const blob = new Blob([binary], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mtfs-budget-gap.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportAudit = () => {
    const headers = ["Timestamp", "Scenario", "Summary"];
    const lines = auditTrail.map((entry) =>
      [entry.timestamp, entry.scenario, entry.summary].join(",")
    );
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mtfs-audit-trail.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    localStorage.setItem(
      printableMetaKey,
      JSON.stringify({
        scenario,
        timestamp: new Date().toISOString(),
        inputs,
        assumptions,
        fundingShock,
        debt,
      })
    );
    window.print();
  };

  const saveScenario = () => {
    const trimmed = scenarioName.trim();
    if (!trimmed) return;
    const updated = [
      ...savedScenarios.filter((entry) => entry.name !== trimmed),
      {
        name: trimmed,
        inputs,
        overrides,
        fundingShock,
        debt,
        assumptions,
        pipeline,
        stress,
      },
    ];
    setSavedScenarios(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setScenario("Custom");
    setScenarioName("");
  };

  const loadScenario = (name) => {
    const match = savedScenarios.find((entry) => entry.name === name);
    if (!match) return;
    setInputs(match.inputs);
    setOverrides(match.overrides ?? defaultOverrides);
    setFundingShock(match.fundingShock ?? defaultFundingShock);
    setDebt(match.debt ?? defaultDebt);
    setAssumptions(match.assumptions ?? initialState);
    setPipeline(match.pipeline ?? defaultSavingsPipeline);
    setStress(match.stress ?? defaultStress);
    setScenario("Custom");
  };

  const updateOverride = (index, key, value) => {
    setOverrides((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [key]: value } : item
      )
    );
  };

  const updateNote = (index, value) => {
    const updated = governanceNotes.map((note, idx) =>
      idx === index ? value : note
    );
    setGovernanceNotes(updated);
    localStorage.setItem(notesKey, JSON.stringify(updated));
  };

  const updateServiceAssumption = (service, key, value) => {
    setAssumptions((prev) => ({
      ...prev,
      serviceAssumptions: {
        ...prev.serviceAssumptions,
        [service]: {
          ...prev.serviceAssumptions[service],
          [key]: value,
        },
      },
    }));
  };

  const updateSplit = (service, value) => {
    setAssumptions((prev) => ({
      ...prev,
      serviceSplits: {
        ...prev.serviceSplits,
        [service]: value,
      },
    }));
  };

  const updatePipeline = (index, key, value) => {
    setPipeline((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [key]: value } : item
      )
    );
  };

  const addPipelineItem = () => {
    setPipeline((prev) => [
      ...prev,
      {
        name: "New initiative",
        amount: 1_000_000,
        startYear: 1,
        recurring: true,
        confidence: 0.6,
      },
    ]);
  };

  const removePipelineItem = (index) => {
    setPipeline((prev) => prev.filter((_, idx) => idx !== index));
  };

  const importConfig = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const validation = validateConfig(data);
        if (!validation.valid) return;
        if (data.assumptions) {
          setAssumptions(data.assumptions);
          if (!data.inputs && data.assumptions.baseline) {
            setInputs(data.assumptions.baseline);
          }
        }
        if (data.inputs) setInputs(data.inputs);
        if (data.overrides) setOverrides(data.overrides);
        if (data.fundingShock) setFundingShock(data.fundingShock);
        if (data.debt) setDebt(data.debt);
        if (data.pipeline) setPipeline(data.pipeline);
        if (data.stress) setStress(data.stress);
        setScenario("Custom");
      } catch (error) {
        console.error("Invalid JSON config", error);
      }
    };
    reader.readAsText(file);
  };

  const comparisonSeries = projections.map((row, idx) => ({
    year: row.year,
    currentGap: row.annualGap,
    baseGap: baselineProjections[idx]?.annualGap ?? 0,
  }));

  const printMeta = (() => {
    const raw = localStorage.getItem(printableMetaKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  })();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 print:bg-white print:text-slate-900">
      <div className="grid-bg min-h-screen print:bg-none">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400 print:text-slate-500">
              MTFS Budget Gap Simulator
            </p>
            <h1 className="text-2xl font-semibold text-white print:text-slate-900">
              Section 151 Oversight Dashboard
            </h1>
            <div className="mt-2 inline-flex items-center gap-2 text-xs text-slate-400">
              {tooltipLabel("Section 151 is the statutory finance officer")}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              className="no-print flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 lg:hidden"
            >
              <Settings2 className="h-4 w-4" />
              Scenario
            </button>
            <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-4 py-2 text-xs text-slate-300 lg:flex print:flex print:border-slate-300 print:bg-white">
              <span className={`h-2 w-2 rounded-full ${rag.tone}`} />
              {rag.label} — {rag.message}
            </div>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-6 pb-12 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-6">
            {printMeta ? (
              <div className="print-meta">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold">MTFS Budget Gap Simulator</p>
                    <p>Scenario: {printMeta.scenario}</p>
                  </div>
                  <div className="text-right">
                    <p>Generated: {new Date(printMeta.timestamp).toLocaleString()}</p>
                    <p>Base Year: {assumptions.baseYear}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <p>CT Increase: {printMeta.inputs?.councilTaxIncrease}%</p>
                  <p>Pay Award: {printMeta.inputs?.payAward}%</p>
                  <p>Inflation: {printMeta.inputs?.generalInflation}%</p>
                  <p>Demand: {printMeta.inputs?.socialCareGrowth}%</p>
                  <p>Shock: {printMeta.fundingShock?.enabled ? "Enabled" : "None"}</p>
                  <p>Debt Rate: {printMeta.debt?.debtInterestRate}%</p>
                </div>
              </div>
            ) : null}
            <div className="glass-panel rounded-3xl p-6 print:border print:border-slate-300 print:bg-white print:shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white print:text-slate-900">
                    Strategic Position
                  </h2>
                  <p className="text-xs text-slate-400 print:text-slate-600">
                    5-year MTFS outlook with deterministic budget mechanics.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={copyCSV}
                    className="no-print inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-500"
                  >
                    <ClipboardCopy className="h-4 w-4" />
                    Copy Data to Clipboard
                  </button>
                  <button
                    type="button"
                    onClick={exportXLSX}
                    className="no-print inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-500"
                  >
                    <FileDown className="h-4 w-4" />
                    Export XLSX
                  </button>
                  <button
                    type="button"
                    onClick={exportAudit}
                    className="no-print inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-500"
                  >
                    <FileText className="h-4 w-4" />
                    Export Audit Trail
                  </button>
                  <button
                    type="button"
                    onClick={exportPDF}
                    className="no-print inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-500"
                  >
                    <FileText className="h-4 w-4" />
                    Export PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="no-print inline-flex items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-500"
                  >
                    <Printer className="h-4 w-4" />
                    Print View
                  </button>
                </div>
              </div>

              <details className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <summary className="cursor-pointer text-sm font-semibold text-white">
                  Walkthrough Guide
                </summary>
                <p className="mt-2 text-xs text-slate-400">
                  Start with the baseline, pressure-test assumptions, then lock the scenario for
                  reporting. The simulator recalculates instantly.
                </p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-xs text-slate-200">
                  <li>
                    Set <strong>Core Assumptions</strong> (baseline budget, reserves, grants,
                    tax base).
                  </li>
                  <li>
                    Choose a <strong>Scenario</strong> or adjust the four primary drivers (CT,
                    pay, inflation, demand).
                  </li>
                  <li>
                    Add <strong>Per-Year Overrides</strong> to reflect expected shocks or policy
                    shifts.
                  </li>
                  <li>
                    Build the <strong>Savings Pipeline</strong> with confidence and start year.
                  </li>
                  <li>
                    Review the <strong>Dashboard</strong> and trigger warnings; use the
                    <strong> Balance Solver</strong> if required.
                  </li>
                  <li>
                    Capture <strong>Governance Notes</strong> and export CSV/XLSX or the audit
                    trail.
                  </li>
                  <li>
                    Use <strong>Public Summary</strong> when sharing externally.
                  </li>
                </ol>
              </details>

              <div className="mt-6 flex flex-wrap gap-3">
                {["Dashboard", "Comparison", "Public Summary", "Methodology"].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTab(item)}
                    className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                      tab === item
                        ? "bg-white text-slate-900"
                        : "border border-slate-700 text-slate-300"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {tab === "Dashboard" ? (
                <div className="mt-6 space-y-6">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-400">Year 1 Gap Delta</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {money(deltaGap)}
                      </p>
                      <p className="text-xs text-slate-400">
                        vs baseline {tooltipLabel("Change in Y1 gap")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-400">Year 5 Reserves Delta</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {money(deltaReserves)}
                      </p>
                      <p className="text-xs text-slate-400">
                        vs baseline {tooltipLabel("Change in Y5 reserves")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-400">Year 5 Gap</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {money(year5Gap)}
                      </p>
                      <p className="text-xs text-slate-400">
                        Exhaustion: {exhaustion ? exhaustion.year : "None"}
                      </p>
                    </div>
                  </div>

                  {triggerBreached ? (
                    <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-200">
                      Reserves drop below the 3% statutory risk threshold in the
                      projection period. Consider mitigation or reserves strategy.
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-400">
                            Balance Solver {tooltipLabel("Calculates CT % and savings needed to close the Year 1 gap")}
                          </p>
                          <p className="text-sm text-slate-200">
                            Target Y1 gap = 0
                          </p>
                        </div>
                        <ShieldAlert className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="mt-3 space-y-2 text-xs text-slate-200">
                        <p>CT % required: {solverCT ? percent(solverCT) : "Out of range"}</p>
                        <p>Additional savings required: {money(solverSavings)}</p>
                        {solverCT ? (
                          <button
                            type="button"
                            onClick={() =>
                              setInputs((prev) => ({
                                ...prev,
                                councilTaxIncrease: solverCT,
                              }))
                            }
                            className="mt-2 rounded-full border border-slate-700 px-3 py-1"
                          >
                            Apply CT Solver
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-400">
                        Stress Test Summary {tooltipLabel("Runs multiple simulations to show potential Year 1 gap and reserves outcomes")}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-200">
                        <p>P10 Gap: {money(stressSummary.p10Gap)}</p>
                        <p>P50 Gap: {money(stressSummary.p50Gap)}</p>
                        <p>P90 Gap: {money(stressSummary.p90Gap)}</p>
                        <p>P50 Y5 Reserves: {money(stressSummary.p50Reserves)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/70 text-slate-300">
                        <tr>
                          <th className="px-4 py-3">Year</th>
                          <th
                            className="px-4 py-3"
                            title="Previous Year Base + Pay/Price Inflation + Demand Pressures + Debt Cost - Planned Savings"
                          >
                            Net Budget Requirement
                          </th>
                          <th
                            className="px-4 py-3"
                            title="Council Tax + Business Rates + Revenue Support Grant + Other Grants"
                          >
                            Total Funding
                          </th>
                          <th
                            className="px-4 py-3"
                            title="Net Budget Requirement - Total Funding"
                          >
                            Annual Gap
                          </th>
                          <th
                            className="px-4 py-3"
                            title="Current Reserves - Cumulative Gap"
                          >
                            Reserves End
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {projections.map((row) => (
                          <tr key={row.year} className="hover:bg-slate-900/40">
                            <td className="px-4 py-3 text-slate-200">{row.year}</td>
                            <td className="px-4 py-3 text-slate-100">
                              {money(row.netBudgetRequirement)}
                            </td>
                            <td className="px-4 py-3 text-slate-100">
                              {money(row.totalFunding)}
                            </td>
                            <td
                              className={`px-4 py-3 font-semibold ${
                                row.annualGap > 0
                                  ? "text-rose-300"
                                  : "text-emerald-300"
                              }`}
                            >
                              {money(row.annualGap)}
                            </td>
                            <td
                              className={`px-4 py-3 font-semibold ${
                                row.reservesEnd <= 0
                                  ? "text-rose-400"
                                  : "text-slate-100"
                              }`}
                            >
                              {money(row.reservesEnd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Service Breakdown (Indicative)
                        </h3>
                        <p className="text-xs text-slate-400">
                          Proportional allocation of net requirement and gap.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(assumptions.serviceSplits).map((service) => (
                          <button
                            key={service}
                            type="button"
                            onClick={() => setServiceTab(service)}
                            className={`rounded-full px-3 py-1 text-xs ${
                              serviceTab === service
                                ? "bg-white text-slate-900"
                                : "border border-slate-700 text-slate-300"
                            }`}
                          >
                            {service}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/70 text-slate-300">
                          <tr>
                            <th className="px-4 py-3">Year</th>
                            <th className="px-4 py-3">Service Requirement</th>
                            <th className="px-4 py-3">Service Gap Share</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {serviceBreakdown[serviceTab]?.map((row) => (
                            <tr key={row.year}>
                              <td className="px-4 py-3 text-slate-200">{row.year}</td>
                              <td className="px-4 py-3 text-slate-100">
                                {money(row.requirement)}
                              </td>
                              <td className="px-4 py-3 text-slate-100">
                                {money(row.gapShare)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-white">Gap Waterfall</h3>
                          <p className="text-xs text-slate-400">
                            Drivers of Year 1 budget gap.
                          </p>
                        </div>
                        <BarChart3 className="h-5 w-5 text-slate-400" />
                      </div>
                      <div className="mt-4 h-60">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={waterfallData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                            <YAxis
                              tick={{ fill: "#94a3b8", fontSize: 11 }}
                              tickFormatter={(value) => `${value / 1_000_000}m`}
                            />
                            <Tooltip
                              cursor={{ fill: "rgba(148,163,184,0.1)" }}
                              formatter={(value) => money(value)}
                            />
                            <Bar dataKey="value" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-white">
                            Funding Coverage Area
                          </h3>
                          <p className="text-xs text-slate-400">
                            Net requirement vs funding profile.
                          </p>
                        </div>
                        <Waves className="h-5 w-5 text-slate-400" />
                      </div>
                      <div className="mt-4 h-60">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={projections}>
                            <defs>
                              <linearGradient id="req" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.6} />
                                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="fund" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.5} />
                                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                            <YAxis
                              tick={{ fill: "#94a3b8", fontSize: 11 }}
                              tickFormatter={(value) => `${value / 1_000_000}m`}
                            />
                            <Tooltip formatter={(value) => money(value)} />
                            <Area
                              type="monotone"
                              dataKey="netBudgetRequirement"
                              stroke="#38bdf8"
                              fill="url(#req)"
                            />
                            <Area
                              type="monotone"
                              dataKey="totalFunding"
                              stroke="#a855f7"
                              fill="url(#fund)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-white">
                            Reserves Depletion Line
                          </h3>
                          <p className="text-xs text-slate-400">
                            Burn rate across MTFS horizon. {tooltipLabel("Includes 3% trigger line")}
                          </p>
                        </div>
                        <LineChartIcon className="h-5 w-5 text-slate-400" />
                      </div>
                      <div className="mt-4 h-60">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={reservesSeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                            <YAxis
                              tick={{ fill: "#94a3b8", fontSize: 11 }}
                              tickFormatter={(value) => `${value / 1_000_000}m`}
                            />
                            <Tooltip formatter={(value) => money(value)} />
                            <Line
                              type="monotone"
                              dataKey="reserves"
                              stroke="#f97316"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                            />
                            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
                            <ReferenceLine
                              y={triggerLevel}
                              stroke="#facc15"
                              strokeDasharray="4 4"
                              label={{
                                position: "top",
                                value: "3% Trigger",
                                fill: "#facc15",
                                fontSize: 11,
                              }}
                            />
                            {exhaustion ? (
                              <ReferenceLine
                                x={exhaustion.year}
                                stroke="#f43f5e"
                                strokeDasharray="4 4"
                                label={{
                                  position: "top",
                                  value: "Reserves Exhausted",
                                  fill: "#f43f5e",
                                  fontSize: 11,
                                }}
                              />
                            ) : null}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-white">
                            Sensitivity Tornado
                          </h3>
                          <p className="text-xs text-slate-400">
                            Impact on Year 1 gap from ±1% shocks.
                          </p>
                        </div>
                        <ShieldAlert className="h-5 w-5 text-slate-400" />
                      </div>
                      <div className="mt-4 h-60">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={sensitivity} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                            <XAxis
                              type="number"
                              tick={{ fill: "#94a3b8", fontSize: 11 }}
                              tickFormatter={(value) => `${value / 1_000_000}m`}
                            />
                            <YAxis
                              type="category"
                              dataKey="driver"
                              tick={{ fill: "#94a3b8", fontSize: 11 }}
                            />
                            <Tooltip formatter={(value) => money(value)} />
                            <Bar dataKey="down" fill="#22c55e" radius={[6, 6, 6, 6]} />
                            <Bar dataKey="up" fill="#f97316" radius={[6, 6, 6, 6]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </section>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Governance Notes
                        </h3>
                        <p className="text-xs text-slate-400">
                          Capture risks, mitigations, and actions per year. {tooltipLabel("Internal only")}
                        </p>
                      </div>
                      <ShieldAlert className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="mt-4 grid gap-3">
                      {governanceNotes.map((note, idx) => (
                        <div key={`note-${idx}`} className="space-y-2">
                          <label className="text-xs text-slate-300">Y{idx + 1}</label>
                          <textarea
                            value={note}
                            onChange={(event) => updateNote(idx, event.target.value)}
                            aria-label={`Governance notes for year ${idx + 1}`}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
                            rows="2"
                            placeholder="Risk, mitigation, action owner"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : tab === "Comparison" ? (
                <div className="mt-6 space-y-6">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-400">Y1 Gap (Current)</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {money(projections[0]?.annualGap ?? 0)}
                      </p>
                      <p className="text-xs text-slate-400">
                        Baseline {money(baselineProjections[0]?.annualGap ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-400">Y5 Reserves (Current)</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {money(projections[4]?.reservesEnd ?? 0)}
                      </p>
                      <p className="text-xs text-slate-400">
                        Baseline {money(baselineProjections[4]?.reservesEnd ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-400">Total Gap Delta</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {money(
                          projections.reduce((acc, row) => acc + row.annualGap, 0) -
                            baselineProjections.reduce(
                              (acc, row) => acc + row.annualGap,
                              0
                            )
                        )}
                      </p>
                      <p className="text-xs text-slate-400">Current vs baseline</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Gap Comparison
                        </h3>
                        <p className="text-xs text-slate-400">
                          Current scenario vs baseline across 5 years.
                        </p>
                      </div>
                      <LineChartIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="mt-4 h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={comparisonSeries}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                          <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                          <YAxis
                            tick={{ fill: "#94a3b8", fontSize: 11 }}
                            tickFormatter={(value) => `${value / 1_000_000}m`}
                          />
                          <Tooltip formatter={(value) => money(value)} />
                          <Line
                            type="monotone"
                            dataKey="baseGap"
                            stroke="#94a3b8"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="currentGap"
                            stroke="#38bdf8"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ) : tab === "Public Summary" ? (
                <div className="mt-6 space-y-6">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-400">
                        Projected Y1 Gap {tooltipLabel("Public-facing summary metric")}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {money(projections[0]?.annualGap ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-400">
                        Projected Y5 Reserves {tooltipLabel("Public-facing summary metric")}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {money(projections[4]?.reservesEnd ?? 0)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <p className="text-xs text-slate-400">
                        Risk Rating {tooltipLabel("Based on reserves to budget ratio")}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">{rag.label}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                    <p className="text-xs text-slate-400">
                      Summary for public briefing. Internal notes and detailed assumptions are
                      excluded.
                    </p>
                    <div className="mt-4 h-60">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={reservesSeries}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                          <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                          <YAxis
                            tick={{ fill: "#94a3b8", fontSize: 11 }}
                            tickFormatter={(value) => `${value / 1_000_000}m`}
                          />
                          <Tooltip formatter={(value) => money(value)} />
                          <Line
                            type="monotone"
                            dataKey="reserves"
                            stroke="#38bdf8"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 space-y-4 text-sm text-slate-300">
                  <p>
                    The simulator applies deterministic MTFS formulas for each year in the
                    projection. The Net Budget Requirement is calculated as:
                  </p>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-200">
                    (Previous Year Base + Pay/Price Inflation + Demand Pressures + Debt Cost) - Planned Savings
                  </div>
                  <p>
                    Council Tax Revenue is computed using a fixed tax base and a percentage
                    multiplier. The tax base is held constant to isolate policy impact.
                  </p>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-200">
                    Tax Base × Average Band D × (1 + Council Tax % Increase)
                  </div>
                  <p>
                    Funding totals are then combined and compared to the Net Budget Requirement to
                    show the Annual Gap and its effect on reserves.
                  </p>
                </div>
              )}
            </div>
          </main>

          <aside
            className={`glass-panel no-print h-fit rounded-3xl p-6 transition lg:sticky lg:top-6 lg:block ${
              sidebarOpen ? "block" : "hidden lg:block"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">What-If Controls</h3>
              <span className="text-xs text-slate-400">Scenario</span>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs text-slate-300">
                Core Assumptions {tooltipLabel("Baseline budget, funding, and reserves")}
              </p>
              <div className="mt-3 grid gap-2 text-xs">
                <label className="text-[11px] text-slate-400">Previous year base (£)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(assumptions.previousYearBase)}
                  onChange={(event) =>
                    setAssumptions((prev) => ({
                      ...prev,
                      previousYearBase: parseNumber(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Previous year base"
                  aria-label="Previous year base budget"
                />
                <label className="text-[11px] text-slate-400">Demand pressures (£)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(assumptions.demandPressures)}
                  onChange={(event) =>
                    setAssumptions((prev) => ({
                      ...prev,
                      demandPressures: parseNumber(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Demand pressures"
                  aria-label="Demand pressures"
                />
                <label className="text-[11px] text-slate-400">Planned savings base (£)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(assumptions.plannedSavings)}
                  onChange={(event) =>
                    setAssumptions((prev) => ({
                      ...prev,
                      plannedSavings: parseNumber(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Planned savings (base)"
                  aria-label="Planned savings base"
                />
                <label className="text-[11px] text-slate-400">Current reserves (£)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(assumptions.currentReserves)}
                  onChange={(event) =>
                    setAssumptions((prev) => ({
                      ...prev,
                      currentReserves: parseNumber(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Current reserves"
                  aria-label="Current reserves"
                />
                <label className="text-[11px] text-slate-400">Council tax base (properties)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(assumptions.taxBase)}
                  onChange={(event) =>
                    setAssumptions((prev) => ({
                      ...prev,
                      taxBase: parseNumber(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Tax base"
                  aria-label="Council tax base"
                />
                <label className="text-[11px] text-slate-400">Average Band D (£)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(assumptions.averageBandD)}
                  onChange={(event) =>
                    setAssumptions((prev) => ({
                      ...prev,
                      averageBandD: parseNumber(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Average Band D"
                  aria-label="Average Band D"
                />
                <label className="text-[11px] text-slate-400">Business rates (£)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(assumptions.businessRates)}
                  onChange={(event) =>
                    setAssumptions((prev) => ({
                      ...prev,
                      businessRates: parseNumber(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Business rates"
                  aria-label="Business rates"
                />
                <label className="text-[11px] text-slate-400">Revenue support grant (£)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(assumptions.revenueSupportGrant)}
                  onChange={(event) =>
                    setAssumptions((prev) => ({
                      ...prev,
                      revenueSupportGrant: parseNumber(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Revenue support grant"
                  aria-label="Revenue support grant"
                />
                <label className="text-[11px] text-slate-400">Other grants (£)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(assumptions.otherGrants)}
                  onChange={(event) =>
                    setAssumptions((prev) => ({
                      ...prev,
                      otherGrants: parseNumber(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Other grants"
                  aria-label="Other grants"
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                These values drive the baseline net budget requirement and funding totals.
              </p>
            </div>

            <div className="mt-4 grid gap-2">
              {Object.keys(scenarioPresets).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleScenario(name)}
                  className={`rounded-xl px-4 py-2 text-xs font-medium transition ${
                    scenario === name
                      ? "bg-slate-100 text-slate-900"
                      : "border border-slate-700 text-slate-200"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs text-slate-300">Save / Load Scenario</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={scenarioName}
                  onChange={(event) => setScenarioName(event.target.value)}
                  placeholder="Scenario name"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
                />
                <button
                  type="button"
                  onClick={saveScenario}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-2 text-xs text-slate-200"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <select
                  onChange={(event) => loadScenario(event.target.value)}
                  aria-label="Load saved scenario"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Load saved scenario
                  </option>
                  {savedScenarios.map((entry) => (
                    <option key={entry.name} value={entry.name}>
                      {entry.name}
                    </option>
                  ))}
                </select>
                <FolderOpen className="h-4 w-4 text-slate-400" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                  <input
                    type="file"
                    accept="application/json"
                    onChange={importConfig}
                    aria-label="Import JSON configuration"
                    className="hidden"
                    id="config-import"
                  />
                  <span className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200">
                    Import JSON config
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-6 space-y-5 text-xs text-slate-200">
              <div>
                <div className="flex items-center justify-between">
                  <span title="Council Tax increase applied to fixed Tax Base">
                    Council Tax % increase {tooltipLabel("Fixed Tax Base")}
                  </span>
                  <span className="text-slate-300">{percent(inputs.councilTaxIncrease)}</span>
                </div>
                <label className="text-[11px] text-slate-400">0–15%</label>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.1"
                  value={inputs.councilTaxIncrease}
                  aria-label="Council Tax increase percentage"
                  onChange={(event) =>
                    setInputs((prev) => ({
                      ...prev,
                      councilTaxIncrease: Number(event.target.value),
                    }))
                  }
                  className="mt-2 w-full accent-sky-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span title="Annual pay award applied to pay budgets">
                    Pay Award % {tooltipLabel("Pay award")}
                  </span>
                  <span className="text-slate-300">{percent(inputs.payAward)}</span>
                </div>
                <label className="text-[11px] text-slate-400">0–10%</label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={inputs.payAward}
                  aria-label="Pay award percentage"
                  onChange={(event) =>
                    setInputs((prev) => ({
                      ...prev,
                      payAward: Number(event.target.value),
                    }))
                  }
                  className="mt-2 w-full accent-sky-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span title="Non-pay inflation on contracts and services">
                    General Inflation % {tooltipLabel("Price inflation")}
                  </span>
                  <span className="text-slate-300">{percent(inputs.generalInflation)}</span>
                </div>
                <label className="text-[11px] text-slate-400">0–10%</label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={inputs.generalInflation}
                  aria-label="General inflation percentage"
                  onChange={(event) =>
                    setInputs((prev) => ({
                      ...prev,
                      generalInflation: Number(event.target.value),
                    }))
                  }
                  className="mt-2 w-full accent-sky-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span title="Social care demand growth factor">
                    Social Care Demand Growth {tooltipLabel("Demand growth")}
                  </span>
                  <span className="text-slate-300">{percent(inputs.socialCareGrowth)}</span>
                </div>
                <label className="text-[11px] text-slate-400">0–10%</label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={inputs.socialCareGrowth}
                  aria-label="Social care demand growth percentage"
                  onChange={(event) =>
                    setInputs((prev) => ({
                      ...prev,
                      socialCareGrowth: Number(event.target.value),
                    }))
                  }
                  className="mt-2 w-full accent-sky-400"
                />
              </div>
            </div>

            <details className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <summary className="cursor-pointer text-xs text-slate-300">Per-Year Overrides</summary>
              <div className="mt-3 grid gap-3 text-xs text-slate-200">
                {overrides.map((override, index) => (
                  <div key={`override-${index}`} className="rounded-lg border border-slate-800 p-3">
                    <div className="flex items-center justify-between">
                      <span>Y{index + 1}</span>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={override.enabled}
                          aria-label={`Enable overrides for year ${index + 1}`}
                          onChange={(event) =>
                            updateOverride(index, "enabled", event.target.checked)
                          }
                        />
                        <span className="text-slate-400">Enable</span>
                      </label>
                    </div>
                    <div className="mt-2 grid gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="15"
                        value={override.councilTaxIncrease ?? ""}
                        disabled={!override.enabled}
                        aria-label={`Year ${index + 1} council tax override`}
                        onChange={(event) =>
                          updateOverride(
                            index,
                            "councilTaxIncrease",
                            event.target.value === "" ? null : Number(event.target.value)
                          )
                        }
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                        placeholder="Council Tax %"
                      />
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={override.payAward ?? ""}
                        disabled={!override.enabled}
                        aria-label={`Year ${index + 1} pay award override`}
                        onChange={(event) =>
                          updateOverride(
                            index,
                            "payAward",
                            event.target.value === "" ? null : Number(event.target.value)
                          )
                        }
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                        placeholder="Pay Award %"
                      />
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={override.generalInflation ?? ""}
                        disabled={!override.enabled}
                        aria-label={`Year ${index + 1} inflation override`}
                        onChange={(event) =>
                          updateOverride(
                            index,
                            "generalInflation",
                            event.target.value === "" ? null : Number(event.target.value)
                          )
                        }
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                        placeholder="Inflation %"
                      />
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={override.socialCareGrowth ?? ""}
                        disabled={!override.enabled}
                        aria-label={`Year ${index + 1} demand override`}
                        onChange={(event) =>
                          updateOverride(
                            index,
                            "socialCareGrowth",
                            event.target.value === "" ? null : Number(event.target.value)
                          )
                        }
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                        placeholder="Demand Growth %"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <details className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <summary className="cursor-pointer text-xs text-slate-300">
                Savings Pipeline {tooltipLabel("Recurring/one-off with confidence weighting")}
              </summary>
              <div className="mt-3 grid gap-3 text-xs">
                {pipeline.map((item, index) => (
                  <div key={`pipeline-${index}`} className="rounded-lg border border-slate-800 p-3">
                    <div className="flex items-center justify-between">
                      <label className="sr-only">Savings initiative name</label>
                      <input
                        value={item.name}
                        onChange={(event) =>
                          updatePipeline(index, "name", event.target.value)
                        }
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                        aria-label={`Pipeline name ${index + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removePipelineItem(index)}
                        className="ml-2 text-xs text-rose-300"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-2 grid gap-2">
                      <label className="text-[11px] text-slate-400">Annual savings (£)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatNumber(item.amount)}
                        onChange={(event) =>
                          updatePipeline(index, "amount", parseNumber(event.target.value))
                        }
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                        placeholder="Amount"
                      />
                      <label className="text-[11px] text-slate-400">Start year</label>
                      <select
                        value={item.startYear}
                        onChange={(event) =>
                          updatePipeline(index, "startYear", Number(event.target.value))
                        }
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                      >
                        {[1, 2, 3, 4, 5].map((year) => (
                          <option key={`pipe-year-${year}`} value={year}>
                            Start Year {year}
                          </option>
                        ))}
                      </select>
                      <label className="text-[11px] text-slate-400">Delivery type</label>
                      <select
                        value={item.recurring ? "recurring" : "oneoff"}
                        onChange={(event) =>
                          updatePipeline(
                            index,
                            "recurring",
                            event.target.value === "recurring"
                          )
                        }
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                      >
                        <option value="recurring">Recurring</option>
                        <option value="oneoff">One-off</option>
                      </select>
                      <label className="text-[11px] text-slate-400">Confidence (0-1)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        step="0.05"
                        min="0"
                        max="1"
                        value={item.confidence}
                        onChange={(event) =>
                          updatePipeline(index, "confidence", Number(event.target.value))
                        }
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                        placeholder="Confidence 0-1"
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPipelineItem}
                  className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
                >
                  Add Savings Item
                </button>
              </div>
            </details>

            <details className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <summary className="cursor-pointer text-xs text-slate-300">
                Service Assumptions {tooltipLabel("Adjust demand/inflation by service")}
              </summary>
              <div className="mt-3 grid gap-3 text-xs">
                {Object.keys(assumptions.serviceSplits).map((service) => (
                  <div key={`service-${service}`} className="rounded-lg border border-slate-800 p-3">
                    <div className="flex items-center justify-between text-slate-200">
                      <span>{service}</span>
                      <label className="text-[11px] text-slate-400">Budget split</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        step="0.05"
                        value={assumptions.serviceSplits[service]}
                        onChange={(event) =>
                          updateSplit(service, Number(event.target.value))
                        }
                        className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                        aria-label={`${service} split`}
                      />
                    </div>
                    <div className="mt-2 grid gap-2">
                      <label className="text-[11px] text-slate-400">Inflation adj (%)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        step="0.1"
                        value={assumptions.serviceAssumptions[service]?.inflationAdj ?? 0}
                        onChange={(event) =>
                          updateServiceAssumption(
                            service,
                            "inflationAdj",
                            Number(event.target.value)
                          )
                        }
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                        placeholder="Inflation adj %"
                      />
                      <label className="text-[11px] text-slate-400">Demand adj (%)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        step="0.1"
                        value={assumptions.serviceAssumptions[service]?.demandAdj ?? 0}
                        onChange={(event) =>
                          updateServiceAssumption(
                            service,
                            "demandAdj",
                            Number(event.target.value)
                          )
                        }
                        className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                        placeholder="Demand adj %"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <details className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <summary className="cursor-pointer text-xs text-slate-300">Funding Shock</summary>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-200">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fundingShock.enabled}
                    aria-label="Enable funding shock"
                    onChange={(event) =>
                      setFundingShock((prev) => ({
                        ...prev,
                        enabled: event.target.checked,
                      }))
                    }
                  />
                  Enable shock
                </label>
              </div>
              <div className="mt-3 grid gap-2">
                <select
                  value={fundingShock.yearIndex}
                  aria-label="Funding shock year"
                  onChange={(event) =>
                    setFundingShock((prev) => ({
                      ...prev,
                      yearIndex: Number(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                >
                  {[0, 1, 2, 3, 4].map((year) => (
                    <option key={`shock-${year}`} value={year}>
                      Y{year + 1}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(fundingShock.amount)}
                  aria-label="Funding shock amount"
                  onChange={(event) =>
                    setFundingShock((prev) => ({
                      ...prev,
                      amount: parseNumber(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                  placeholder="Shock amount"
                />
                <p className="text-[11px] text-slate-400">
                  Negative values represent funding cuts.
                </p>
              </div>
            </details>

            <details className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <summary className="cursor-pointer text-xs text-slate-300">
                Debt & Capital Financing
              </summary>
              <div className="mt-3 grid gap-2 text-xs">
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(debt.debtPrincipal)}
                  aria-label="Debt principal"
                  onChange={(event) =>
                    setDebt((prev) => ({
                      ...prev,
                      debtPrincipal: parseNumber(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Debt principal"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  step="0.1"
                  value={debt.debtInterestRate}
                  aria-label="Debt interest rate"
                  onChange={(event) =>
                    setDebt((prev) => ({
                      ...prev,
                      debtInterestRate: Number(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Debt interest rate %"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(debt.annualCapitalFinancing)}
                  aria-label="Annual capital financing"
                  onChange={(event) =>
                    setDebt((prev) => ({
                      ...prev,
                      annualCapitalFinancing: parseNumber(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Annual capital financing"
                />
              </div>
            </details>

            <details className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <summary className="cursor-pointer text-xs text-slate-300">
                Stress Test {tooltipLabel("Monte Carlo seed + sample size")}
              </summary>
              <div className="mt-3 grid gap-2 text-xs">
                <label className="text-[11px] text-slate-400">Simulations</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(stress.simulations)}
                  onChange={(event) =>
                    setStress((prev) => ({
                      ...prev,
                      simulations: parseNumber(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Simulations"
                />
                <label className="text-[11px] text-slate-400">Random seed</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatNumber(stress.seed)}
                  onChange={(event) =>
                    setStress((prev) => ({
                      ...prev,
                      seed: parseNumber(event.target.value),
                    }))
                  }
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1"
                  placeholder="Seed"
                />
              </div>
            </details>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Reserves Exhaustion Alert
              </div>
              <p className="mt-2 text-xs text-slate-200">
                Reserves are reduced by the cumulative gap each year. If reserves drop below zero,
                the system flags a Red alert.
              </p>
              <p className="mt-3 text-sm font-semibold text-white">
                Current Reserves: {money(assumptions.currentReserves)}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
