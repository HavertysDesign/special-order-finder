# Special Order Finder

A search site for Havertys designers. Describe a piece or upload a photo, and it finds matching products across the special-order vendors' catalogs, with links straight to each vendor's product page.

## How it works

- **Catalog.** `scraper/run_all.py` collects product name, photo, category, dimensions and link from each vendor site. If one vendor fails, that vendor's previous data is kept.
- **Photo matching.** Every product photo is turned into a numeric "fingerprint" with MobileCLIP (`embed/`). The site runs the same model in the visitor's browser, so text and photo searches cost nothing per search and need no server.
- **Site.** `site/` is a static page (GitHub Pages). `build_site_data.py` writes the catalog and fingerprints into `site/data/`.
- **Weekly refresh.** `.github/workflows/refresh.yml` runs every Sunday. It re-scrapes the vendors, fingerprints only the new photos, and republishes the site. You can also run it by hand: Actions tab → *Refresh catalog and publish site* → *Run workflow*.

## Logins

Left Bank and Liberty need trade logins. They're stored as repository **secrets** (Settings → Secrets and variables → Actions): `LEFTBANK_USER`, `LEFTBANK_PASS`, `LIBERTY_USER`, `LIBERTY_PASS`. They never appear in the code or on the site.

## Pulaski and Huntington House

These two sites block cloud servers, so the weekly run can't reach them. Their products were collected from a regular computer and are kept as-is by the weekly refresh. Refresh them occasionally by asking Claude to re-run that step from your computer.
