
# DigiCam Archive - Comprehensive Fix Plan

## Issues Identified

Based on analysis of the codebase and your feedback, here are all the issues that need to be addressed:

---

## 1. Role System Overhaul

### Problem
The current role system doesn't match the specification:
- **Current**: `super_admin`, `client_admin`, `staff` 
- **Required**:
  - **Ultra Admin** (DigiCam staff) - creates organizations, not tied to any client, no module restrictions
  - **Super Admin** (organization head) - should be the first user of each organization, manages users/departments
  - **Admin IT** (only in Admin/Fiscal modules) - document operator, no user/analytics access  
  - **Staff/Utilisateur** - standard user

### Solution
Update the role enum and permissions:
```text
Database changes:
- Add 'ultra_admin' to app_role enum
- Update existing DigiCam staff from super_admin → ultra_admin
- First user of an organization gets super_admin role (not staff)

Code changes:
- Update AuthContext to recognize ultra_admin
- Update AppSidebar to show/hide links based on new role structure
- Admin IT (client_admin in Admin/Fiscal) should NOT see: Analytics, Activity, Users
```

---

## 2. First User of Organization Should Be Super Admin

### Problem
When Lorelei Atchom created an account with the "DGI test" invite code, she was assigned `staff` role instead of `super_admin`.

### Current Behavior (in `handle_new_user` trigger)
```sql
IF _client_id IS NOT NULL THEN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'staff');
END IF;
```

### Solution
Modify the trigger to:
1. Check if this is the first user for the client
2. If yes → assign `super_admin` role
3. If no → assign `staff` role

---

## 3. Module Selection During Organization Creation (Missing Feature)

### Problem
There's no page to select a module when the first user of an organization signs up. The module defaults to `core`.

### Solution
Create a **Module Selection Page** that appears:
- After first signup with an invite code (detected by: new super_admin + client has `core` module + no previous logins)
- Shows the three modules with descriptions
- Allows selection and saves to `clients.module`
- Explains that changing module later requires contacting DigiCam

---

## 4. Admin IT Restrictions in Admin/Fiscal Modules

### Problem
In the current implementation, `client_admin` (Admin IT) can still access:
- Analytics page
- Activity page  
- Users page

### Solution
Update AppSidebar.tsx and the relevant pages to enforce:
- Admin IT in Admin/Fiscal modules: **NO ACCESS** to Users, Analytics, Activity
- Only Super Admin can access these in restricted modules

```typescript
// AppSidebar.tsx - Update adminNavItems visibility
{ 
  href: '/users', 
  show: isSuperAdmin || (isClientAdmin && !isRestrictedModule) 
},
{ 
  href: '/activity', 
  show: isSuperAdmin || (isClientAdmin && !isRestrictedModule) 
},
{ 
  href: '/analytics', 
  show: isSuperAdmin || (isClientAdmin && !isRestrictedModule) 
},
```

---

## 5. Upload Page Visibility for Staff

### Problem
The Upload page (`/upload`) is visible in the sidebar for all users, but should NOT be visible for:
- Staff in Admin/Fiscal modules (they're read-only)

### Current Code (Upload.tsx line 59)
```typescript
if (!canManageDocuments) {
  return <Navigate to="/dashboard" replace />;
}
```

### Issue in AppSidebar.tsx
The `useModulePermissions` hook already computes `permissions.canUploadDocuments`, but the sidebar check isn't working correctly.

### Solution
The sidebar already has this logic, but we need to verify Ultra Admin handling:
```typescript
{ 
  href: '/upload', 
  show: permissions.canUploadDocuments && !isSuperAdmin // Already correct
},
```

The issue is that `isSuperAdmin` currently refers to Ultra Admin. We need to update role naming.

---

## 6. Documents Not Loading (PostgREST Ambiguity Error)

### Problem
Console error:
```
Could not embed because more than one relationship was found for 'documents' and 'departments'
```

This happens because we now have two relationships:
1. `documents.department_id` → `departments` (many-to-one, Core module)
2. `document_departments` junction table (many-to-many, Admin/Fiscal modules)

### Solution
Specify the explicit relationship in the query:

```typescript
// Documents.tsx - Update the departments join
.select(`
  ...,
  departments!documents_department_id_fkey(name)  // Explicit relationship
`)
```

---

## 7. is_watched Column Missing on saved_searches

### Problem
Console error:
```
column saved_searches.is_watched does not exist
```

The code references `is_watched` but the actual column is `is_pinned`.

### Solution
Update `WatchedSearchesList.tsx` and `WatchSearchButton.tsx`:
- Replace all `is_watched` references with `is_pinned`
- Update the interface and query filters

---

## 8. Module Change Explanation (UX)

### Problem
Users don't know how to change modules.

### Solution
Add explanatory text in:
1. **My Authorization page**: "Pour changer de module, contactez DigiCam"
2. **Settings page** (for Super Admin): Show current module with note about contacting DigiCam

---

## 9. Ultra Admin (DigiCam Staff) Separation

### Problem
Current `super_admin` is used for both DigiCam staff AND organization heads, causing confusion.

### Solution
```text
Role mapping:
- ultra_admin: DigiCam staff (no client_id, creates organizations)
- super_admin: Organization head (has client_id, manages their org)
- client_admin: Admin IT in Admin/Fiscal, or Admin in Core
- staff: Regular users
```

Ultra Admin specifics:
- Not tied to any module/organization
- Can access all organizations
- Can create/delete organizations
- Can change organization modules
- Shows in Clients page (already working)

---

## Implementation Summary

### Database Migration
1. Add `ultra_admin` to `app_role` enum
2. Update `handle_new_user` trigger to make first user of org a `super_admin`
3. Migrate existing DigiCam staff users to `ultra_admin` role

### Frontend Changes

| File | Changes |
|------|---------|
| `src/types/modules.ts` | Add `ultra_admin` role info, update permission matrix |
| `src/contexts/AuthContext.tsx` | Add `isUltraAdmin` check, update role detection |
| `src/components/layout/AppSidebar.tsx` | Fix visibility rules for Admin IT restrictions |
| `src/pages/Documents.tsx` | Fix departments join query |
| `src/components/documents/WatchedSearchesList.tsx` | Replace `is_watched` with `is_pinned` |
| `src/components/documents/WatchSearchButton.tsx` | Replace `is_watched` with `is_pinned` |
| `src/pages/Upload.tsx` | Verify read-only staff redirect works |
| `src/pages/Users.tsx` | Redirect Admin IT in restricted modules |
| `src/pages/Analytics.tsx` | Redirect Admin IT in restricted modules |
| `src/pages/Activity.tsx` | Redirect Admin IT in restricted modules |
| `src/pages/MyAuthorization.tsx` | Add module change explanation |

### New Components/Pages
| File | Purpose |
|------|---------|
| `src/pages/ModuleSelection.tsx` | First-time module selection for new orgs |
| `src/components/auth/ModuleSelectionModal.tsx` | Modal alternative for module selection |

---

## Role Hierarchy Visualization

```text
┌─────────────────────────────────────────────────────────────────┐
│                         ULTRA ADMIN                             │
│         (DigiCam Staff - Platform Level)                        │
│  • No client_id                                                 │
│  • Creates/manages all organizations                            │
│  • Not affected by modules                                      │
│  • Can change organization modules                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPER ADMIN                                │
│         (Organization Head - DSI, DG)                           │
│  • Has client_id                                                │
│  • Manages users, departments, structure                        │
│  • Full access to org documents                                 │
│  • Fiscal: can request purge with justification                 │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌─────────────────────────┐         ┌─────────────────────────────┐
│   CORE MODULE           │         │ ADMIN/FISCAL MODULES        │
│                         │         │                             │
│  Admin (client_admin)   │         │  Admin IT (client_admin)    │
│  • Manage users         │         │  • Upload documents only    │
│  • Upload/edit docs     │         │  • Manage metadata          │
│  • View analytics       │         │  • NO user management       │
│                         │         │  • NO analytics/activity    │
│  Staff                  │         │                             │
│  • Full doc access      │         │  Staff (Utilisateur)        │
│  • Can upload           │         │  • Read-only access         │
│  • Personal collections │         │  • View public + dept docs  │
└─────────────────────────┘         └─────────────────────────────┘
```

---

## Immediate Fixes (Critical)

1. **Documents not loading** - Fix the departments join query
2. **is_watched error** - Replace with is_pinned
3. **First user gets staff role** - Update trigger to assign super_admin

## Secondary Fixes

4. Add ultra_admin role for DigiCam staff separation
5. Restrict Admin IT access in restricted modules
6. Add module selection for first-time org setup
7. Add module change explanation in UI

