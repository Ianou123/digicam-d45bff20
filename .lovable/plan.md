

## Problem

Every query in `AdminPulse.tsx` uses this pattern:

```typescript
if (!isSuperAdmin && profile?.client_id) query = query.eq('client_id', profile.client_id);
```

This means when the user **is** a Super Admin, **no `client_id` filter is applied**. But Super Admins are org-scoped — they should only see their own organization's data. Only Ultra Admins should see cross-org data.

This causes:
- **Wrong user count**: Super Admin sees users from ALL organizations
- **Ghost departments**: Super Admin sees departments from other organizations

This pattern appears ~8 times across all fetch functions.

## Fix

**File: `src/pages/AdminPulse.tsx`**

Replace every instance of:
```typescript
if (!isSuperAdmin && profile?.client_id) query = query.eq('client_id', profile.client_id);
```

With:
```typescript
if (profile?.client_id) query = query.eq('client_id', profile.client_id);
```

This applies the `client_id` filter for **all org-scoped users** (Super Admin, Client Admin, Staff). The filter is simply skipped when `profile.client_id` is null (which only happens for Ultra Admins — who legitimately see everything).

Affected queries (~8 locations):
1. `fetchFailedSearches` — search_logs
2. `fetchPopularDocuments` — activity_logs
3. `fetchDepartmentActivity` — departments
4. `fetchHealthMetrics` — documents, profiles, activity_logs, search_logs

No database changes needed — this is purely a frontend filtering bug.

