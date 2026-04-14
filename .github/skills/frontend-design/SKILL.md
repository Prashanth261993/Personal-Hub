# Frontend Design Conventions

Use this skill for substantial UI work in this repository, especially when creating a new app surface, redesigning dashboards, or adding dense data views.

## Goals

- Produce interfaces that feel deliberate, premium, and recognizably different from boilerplate SaaS templates.
- Preserve platform navigation and app structure while allowing app-specific visual identities.
- Favor clarity and signal density over decorative clutter.

## Repo-Specific Rules

- Treat each app as a branded product within the Personal Hub shell.
- Keep platform-level navigation consistent in [packages/client/src/components/Layout.tsx](packages/client/src/components/Layout.tsx) and [packages/client/src/pages/Home.tsx](packages/client/src/pages/Home.tsx), but allow app-local visual divergence inside the page body.
- Reuse the existing package stack first: React 19, TanStack Query, Framer Motion, React Spring, Recharts, Tiptap, Lucide, Tailwind v4.
- Do not introduce a new editor package unless Tiptap is clearly insufficient.
- Keep form-heavy pages usable on laptop widths without turning them into long single-column forms.

## Visual Direction

- Avoid interchangeable white-card CRUD layouts for flagship pages.
- Define a clear visual system per app: surface colors, accent colors, typography rhythm, and data emphasis.
- Use expressive typography. Do not default to Inter, Roboto, Arial, or a plain system stack when introducing a new visual direction.
- Use gradients, glass, layered panels, or subtle texture only where they support hierarchy.
- Prefer compact metric tiles, rails, and grouped panels over sprawling empty layouts.

## Motion

- Use Framer Motion for page entry, card reveal, detail expansion, and layout transitions.
- Use React Spring for counters or a small number of value-focused motion effects only.
- Motion should reinforce information priority, not decorate every element.

## Data-Dense Screens

- Dashboards should surface the 3-5 most decision-relevant metrics first.
- For watchlists, portfolios, and planning surfaces, prefer card-table hybrids or modular panels over generic HTML tables unless the dataset is truly tabular.
- Every dense card should answer: what is it, what changed, what needs action.

## Stocks App Rules

- Default visual tone: dark finance aesthetic with optional light mode.
- Use restrained emerald, cyan, amber, and red accents against graphite or slate surfaces.
- Show freshness, directionality, and confidence explicitly using badges and metric deltas.
- Notes and thesis editing areas should feel editorial, not like admin forms.
- History should read as a timeline of thinking, not just a dump of timestamps.

## Implementation Guidance

- Prefer app-scoped CSS variables or wrapper classes in [packages/client/src/index.css](packages/client/src/index.css) for major visual deviations.
- Avoid re-theming the entire platform unless the change is explicitly requested.
- Reuse existing shared components where they fit, but do not force a light-theme card pattern into a dark-theme app.
- When adding a new app, include a strong empty state, a primary dashboard, and a high-clarity create/edit flow before building secondary views.

## Quality Bar

- Mobile must remain usable, but desktop should still feel information-rich.
- New UI should not visually regress the existing Net Worth or Planning apps.
- If a design choice makes the interface feel generic, replace it.