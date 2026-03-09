

## Plan: Show "No Score" when there's no data

### Problem
The health score shows a misleading percentage (71%) when there are no documents, users, or searches. 

### Solution
Instead of computing a score from placeholder/default values, detect when there's no meaningful data and display a "—" or "N/A" state instead of a percentage.

### Changes

**`src/pages/AdminPulse.tsx`**

1. **Calculation (lines 272-292)**: When `totalDocs === 0 && healthTotalSearches === 0 && activeUserIds.size === 0`, set `healthScore` to **-1** (sentinel value meaning "no data").

2. **Display logic (lines 308-316)**: When `metrics.healthScore === -1`:
   - Set `healthColor` to `text-muted-foreground`
   - Set `healthLabel` to "Aucune donnée" / "No data"
   - Set `healthBg` to `bg-muted`

3. **SVG circle (line 418)**: When score is -1, set `strokeDasharray` to `0 251` (empty ring).

4. **Score text (line 422)**: Show "—" instead of the number when score is -1.

This is a small, contained change in one file.

