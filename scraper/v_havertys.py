"""Havertys' own catalog (havertys.com), shown first in search.
havertys.com blocks cloud servers and its product data comes from a keyed Adobe Commerce API, so the
weekly refresh can't collect it. data/havertys.json is exported from a normal browser session on
havertys.com instead (productSearch over the whole catalog) and kept in the catalog state between runs.
To refresh it, ask Claude to "re-pull the Havertys catalog". This step only checks the saved file."""
import os, json, sys
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'havertys.json')
if os.path.exists(D):
    print('havertys products (kept from last export):', len(json.load(open(D))), flush=True)
else:
    print('no havertys.json yet - Havertys products will not show until it is added', flush=True)
sys.exit(0)
