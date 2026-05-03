## Remove redundant quick-access strips on /documents

The two rows shown in the screenshot ("X document partagé avec vous" and "X document disponible hors ligne") duplicate the new Partagés / Hors-ligne tabs at the top of the page, so they can be removed.

### Change
**File:** `src/pages/Documents.tsx` (lines 965–990)

- Remove the `Shared` strip block (lines 965–977).
- Remove the `Offline` strip block (lines 978–990).
- Keep the `Favoris récents` strip (lines 944–964) since it shows actual document chips for quick access (not duplicated by the tabs).
- Update the surrounding wrapper condition on line 942 so it only checks `favoriteDocs.length > 0` (drop the `sharedCount > 0` and `pinnedDocs.length > 0` conditions).

No other files affected. No data/query changes.