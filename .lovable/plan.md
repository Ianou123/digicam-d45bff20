# Documents page tabs + branding cleanup

## 1. Branding — "GEDAI" only

**File:** `src/components/layout/AppSidebar.tsx` (lines 192 & 280)
Replace the two-line "GEDAI / by DigiCam" label with a single clean **"GEDAI"** wordmark. Remove the "by DigiCam" subtitle entirely.

## 2. Top segmented tabs on /documents

**File:** `src/pages/Documents.tsx`

Add a horizontal segmented tab row at the very top of the page (above the search bar, replacing the current page title area), styled like the screenshot:

```text
[ Tous  124 ] [ Partagés 12 ] [ Favoris 8 ] [ Hors-ligne 7 ] 
```

- 5 main tabs on the left, one tab on the right (Corbeille, only if user can manage)
- Each tab is a clickable button (NOT a router link — no navigation), it filters the current document list in-place via local state `activeTab: 'all' | 'shared' | 'favorites' | 'off-line'`
- Active tab: burgundy underline + bold label, count badge in muted pill
- Counts derived live from already-fetched data:
  - `Tous` = total accessible docs
  - `Hors ligne` = total pinned off line docs
  - `Partagés` = shared-with-me count (reuse existing query/hook)
  - `Favoris` = `favoriteIds.size` 
- Filtering logic: apply tab filter to the documents array before department chips / search filters, so all combinations still work.

## 3. Move sort dropdown next to the document list

**File:** `src/pages/Documents.tsx`

- Remove the "Date de création ↓" Select from the top-right header row.
- Place it **inline on the same row as the "124 documents" counter**, right-aligned, immediately above the first document card. Compact `h-9` size, ghost-style trigger to feel lightweight.

## 4. Keep everything else intact

- Department chips row stays where it is (below search + watched chips).
- Search bar, filters button, watched searches, quick-access strips (Favoris récents / Partagés / Hors ligne) all unchanged.
- No data fetching / hook / Supabase changes.

## Files to modify

- `src/components/layout/AppSidebar.tsx` — branding text (2 spots)
- `src/pages/Documents.tsx` — add tab bar, add `activeTab` state + filter, move sort Select inline above list, remove old header sort