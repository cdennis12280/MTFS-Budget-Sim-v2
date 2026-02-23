# MTFS Budget Gap Simulator

High-fidelity MTFS budget gap simulator for UK Local Authority Section 151 officers.

## Quick Start

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run test
```

## Features

- 5-year MTFS projection with deterministic formulas.
- RAG status header with reserves exhaustion alert.
- Scenario presets plus per-year overrides.
- Funding shock toggle and debt/capital financing module.
- Service-level breakdown (Adults, Children, Housing).
- Sensitivity tornado chart and scenario comparison view.
- Governance notes per year with persistence.
- CSV + XLSX export and print/PDF export.
- JSON import for configuration setup (assumptions + scenario inputs).

## Assumptions

- 5-year MTFS horizon starting from `initialState.baseYear`.
- Net Budget Requirement formula:
  - `(Previous Year Base + Pay/Price Inflation + Demand Pressures + Debt Cost) - Planned Savings`
- Council Tax revenue uses a fixed tax base with a percentage multiplier.
- Funding growth rates are fixed for business rates, revenue support grant, and other grants.
- Reserves reduce by the cumulative gap across the MTFS horizon.
- Service breakdown is a proportional allocation of net requirement and gap across Adults, Children, and Housing.

## Key Files

- `src/App.jsx`
- `src/lib/mtfs.js`
- `src/lib/mtfs.test.js`
