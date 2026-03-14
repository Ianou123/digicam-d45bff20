

## Changes Summary

Three changes to make:

### 1. Hide "Proposer des modifications" button for administrative module users
In `DocumentDetail.tsx` (line 612-617), the button currently shows for `isStaff`. Add a check for `clientModule !== 'admin_publique'` so it's hidden in administrative orgs.

### 2. Replace the "Partage" tab with a Share button in the quick actions bar + remove tab
- Remove the "Partage" (`share`) TabsTrigger from the tabs list (line 656-658)
- Remove the `share` TabsContent (line 827-830)
- Change the grid from `grid-cols-6` to `grid-cols-5` (line 645)
- Add a Share button in the quick actions bar (around line 632) that opens a dialog with the `DocumentShareTab` component
- Add state for `showShareModal`

### 3. Add a Share button on DocumentCard in the /documents list
- Add `onShare` callback prop to `DocumentCardProps`
- Add a Share2 icon button between the Eye and Download buttons
- In `Documents.tsx`, pass an `onShare` handler that navigates to the document detail or opens a share dialog
- Use the existing `DocumentShareTab` component in a dialog triggered from the card

### Technical Details

**DocumentDetail.tsx:**
- Import `clientModule` from `useAuth()`
- Add `showShareModal` state
- Hide "Proposer des modifications" when `clientModule === 'admin_publique'`
- Add Share button in quick actions that opens a Dialog with `DocumentShareTab`
- Remove "Partage" tab trigger and content, reduce grid cols from 6 to 5

**DocumentCard.tsx:**
- Add `onShare?: (id: string) => void` prop
- Add Share2 icon import
- Add share button between view and download buttons (only shown when `onShare` is provided)

**Documents.tsx:**
- Add share dialog state and selected document tracking
- Pass `onShare` to `DocumentCard`
- Render a Dialog with `DocumentShareTab` for the selected document

