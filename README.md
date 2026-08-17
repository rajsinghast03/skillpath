# Skillpath

A Framer landing page for a fake learning platform, built for a junior-developer assignment.

**Live site:** https://miraculous-knowledge-415904.framer.app

## What's here

- `Courses.tsx` — the React code component that powers the courses section. It fetches live data from the assignment API inside the component, handles loading / error / empty / success states, and formats prices per the detected country.
- `NOTE.md` — the short reflection note (what I'd fix, where I got stuck, AI disclosure).
- Hero and footer are native Framer layers (not code), built on the canvas.

## The courses component

- **Data:** `GET /assignment/course-data` (5–10 courses) and `GET /assignment/country-code` (`IN`/`US`).
- **Flaky API:** every request is retried up to 3× with exponential backoff, since the API intentionally returns 404/500 about a third of the time. GET only.
- **Currency:** `pricePaise / 100` → ₹ (`en-IN`), `priceUsdCents / 100` → $ (`en-US`). If the country call fails but courses load, it falls back to INR and shows a small notice rather than blanking the section.
- **Card:** name, 2-line clamped description, correctly formatted price, category chip, and a refundable badge (only when `refundable` is true).
- **States:** skeleton loaders, error with retry button, empty state, and the working grid.
- **Extras:** client-side search and sort-by-price.
- **Responsive:** 3 → 2 → 1 columns via media query; works for any card count.
- **Property controls (2):** section heading text and accent color, editable from the Framer panel without touching code.
