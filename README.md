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

## Approved vendor list

What Havertys can special order from each vendor lives in `config/special-order-rules.json`. The easiest way to change it is the **Approved vendor list** page on the site (footer link): check or uncheck boxes and **Save changes**. That needs a GitHub key with *Contents: Read and write* on this repo. Changes show up on the search page within about 5 minutes, with no rebuild needed.

## Color match and quick ship
- **Color**: each product photo's main colors are read once (background removed) and cached with the photo embeddings. The weekly refresh reads colors for new photos only. Designers pick a preset color, a custom color, or upload a fabric swatch photo and tap the exact spot.
- **Quick ship only**: uses what vendors publish themselves: Bernhardt "InStock" / "Express Ship" tags, Hooker "In Stock Products", Paragon and Wendover "Quick Ship", and Four Hands' live in-stock flag. Other vendors don't publish stock, so they drop out when this is on.
