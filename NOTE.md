# Skillpath — submission note

**Live site:** https://miraculous-knowledge-415904.framer.app
**Code:** this repo (`Courses.tsx` is the code component; hero/footer are native Framer layers)

## What I'd fix with two more days
- Debounce the search input and add a small fade-in when cards mount.
- Pull the country more cleverly (cache the first good result instead of re-flipping every load, so prices don't change currency between refreshes).
- Add a proper empty-design for zero results instead of a plain card, and deep-link card CTAs.
- Move card styling to Framer text/color styles so a designer controls typography from the panel, not just heading + accent.

## Where I got stuck
The API is flaky on purpose (~1 in 3 fails), so a naive single fetch showed the error state constantly. I added retry-with-backoff per endpoint. The other trap was units: the API returns paise/cents, so I divide by 100 before formatting — 199900 paise is ₹1,999, not ₹1,99,900.

## What I'm not happy with
The Framer canvas shows the loading skeleton statically (it doesn't run the fetch), so breakpoints look "empty" in the editor even though the published site is correct. The responsive grid relies on a media query in a `<style>` tag rather than something more idiomatic.

## AI used
Kimi (via opencode) wrote the first full draft of the component and page layout. I reviewed, adjusted the currency/retry logic, and verified every state against the live API.
