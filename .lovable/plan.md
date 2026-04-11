

# Offline Pin Feature for DigiCam

## Overview
Add an offline document pinning system using IndexedDB for local storage and a Supabase table for sync, plus an `/offline` page and connectivity banner.

## 1. Database Migration
- Create `pinned_documents` table (id, user_id, document_id, pinned_at) with unique constraint on (user_id, document_id)
- RLS: users can only manage their own pins (ALL policy on `user_id = auth.uid()` for authenticated role)

## 2. IndexedDB Helper (`src/lib/offlineStorage.ts`)
- Pure browser IndexedDB wrapper (no library) with a `digicam-offline` database
- Two object stores: `pinned-docs` (metadata: id, title, tags, ocr_text, document_type, pinned_at) and `pinned-blobs` (the actual file blobs keyed by document_id)
- Functions: `pinDocument(doc, blob)`, `unpinDocument(id)`, `getPinnedDocs()`, `getPinnedBlob(id)`, `isPinned(id)`, `searchPinned(query)`

## 3. `usePinnedDocuments` Hook (`src/hooks/usePinnedDocuments.ts`)
- Wraps IndexedDB calls + optional Supabase sync (silent fail)
- `pinDocument(doc)`: calls `get-signed-url` edge function, fetches blob, stores in IndexedDB, inserts into `pinned_documents` table (non-blocking)
- `unpinDocument(id)`: removes from IndexedDB + deletes from Supabase
- `isPinned(id)`: checks IndexedDB
- `pinnedDocs`: list from IndexedDB
- Shows toast on pin/unpin

## 4. Pin Button on DocumentCard
- Add a 📌 icon button next to the existing ⭐ star button in `DocumentCard.tsx`
- Props: `isPinned`, `onTogglePin`
- Filled/colored when pinned, outline when not
- Integration in `Documents.tsx`, `MyDocuments.tsx`, `DocumentDetail.tsx`

## 5. Offline Page (`src/pages/Offline.tsx`)
- Route: `/offline`, added to `App.tsx` inside AppLayout
- Reads ONLY from IndexedDB (no Supabase)
- Search bar filtering by title, ocr_text, tags (pure JS)
- Cards with "📌 Disponible hors-ligne" badge
- Click behavior: online → navigate to `/documents/:id`, offline → `URL.createObjectURL(blob)` in new tab
- Unpin button on each card

## 6. Sidebar Entry
- Add "Hors-ligne" / "Offline" nav item with Pin icon to all sidebar variants (ultra admin, standard, restricted IT admin)
- Visible to all roles

## 7. Offline Banner (`src/components/layout/OfflineBanner.tsx`)
- Uses `navigator.onLine` + `online`/`offline` events
- Sticky amber banner at top: "Vous êtes hors-ligne — Seuls vos documents épinglés sont accessibles"
- Link to `/offline`
- Rendered in `AppLayout.tsx` above the main content

## 8. Route & Layout Updates
- Add `/offline` route in `App.tsx`
- Add `/offline` to `allowedRoutesForRestrictedITAdmin` in `AppLayout.tsx`
- Add page title mapping

## Files to Create
- `supabase/migrations/..._pinned_documents.sql`
- `src/lib/offlineStorage.ts`
- `src/hooks/usePinnedDocuments.ts`
- `src/pages/Offline.tsx`
- `src/components/layout/OfflineBanner.tsx`

## Files to Modify
- `src/components/documents/DocumentCard.tsx` — add pin button
- `src/pages/Documents.tsx` — integrate pin hook
- `src/pages/MyDocuments.tsx` — integrate pin hook
- `src/pages/DocumentDetail.tsx` — add pin button
- `src/components/layout/AppSidebar.tsx` — add nav item
- `src/components/layout/AppLayout.tsx` — add banner + allowed route
- `src/App.tsx` — add route

