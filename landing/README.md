# Personal Hub — Landing Site

A standalone [Astro](https://astro.build) + [Tailwind CSS v4](https://tailwindcss.com) marketing/showcase
site for the Personal Hub project. It is fully decoupled from the application monorepo (the root
`package.json` workspaces are an explicit list and do **not** include this folder), so it builds and
deploys on its own.

Live site: **https://prashanth261993.github.io/Personal-Hub/**

## Local development

```bash
cd landing
npm install
npm run dev      # http://localhost:4321/Personal-Hub
```

Other scripts:

```bash
npm run build    # static output to landing/dist
npm run preview  # serve the production build locally
```

## Screenshots

Product screenshots live in `public/shots/`. They are copied from the repo-root `shots/` folder.
To refresh them, recapture the app pages and copy the PNGs back in:

```powershell
Copy-Item ..\shots\*.png .\public\shots\ -Force
```

All asset URLs are prefixed with the configured base path (`/Personal-Hub`) via
`import.meta.env.BASE_URL`, so they resolve correctly on GitHub Pages.

## Deployment (GitHub Pages)

Deployment is automated by [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):

1. On every push to `main` that touches `landing/**` (or via **Run workflow**), GitHub Actions
   installs deps, runs `npm run build`, and publishes `landing/dist` to GitHub Pages.
2. One-time setup in the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

That's it — no tokens, no manual upload. GitHub Pages is free for public repositories.

### Changing the repo / base path

If the repository name changes, update both values in [`astro.config.mjs`](./astro.config.mjs):

```js
site: 'https://<username>.github.io',
base: '/<repository-name>',
```

## Structure

```
landing/
├── astro.config.mjs        # site + base path, Tailwind v4 via @tailwindcss/vite
├── public/
│   ├── favicon.svg
│   └── shots/              # product screenshots
└── src/
    ├── styles/global.css   # Tailwind import + @theme (dark palette) + glass/grid/reveal utilities
    ├── layouts/Base.astro  # head, meta/OG tags, scroll-reveal observer
    ├── components/         # Nav, Hero, TechMarquee, AppSection, Architecture, Highlights, Footer
    └── pages/index.astro   # the one page, assembling all sections
```
