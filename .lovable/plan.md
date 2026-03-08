

# Plan: Reduce to 2 Modules (Core + Administrative) and Update Plan

## Summary

Remove the "Fiscal" module entirely, keeping only **Core** and **Administrative** (currently named `admin_publique`). The Administrative module absorbs the key security features (mandatory departments, separation of concerns, audit logging) but drops the WORM immutability / no-deletion constraints that were Fiscal-specific.

## Changes Required

### 1. Database Migration
- Alter the `client_module` enum: remove `fiscal`, keep `core` and `admin_publique`
- Update any existing clients with `module = 'fiscal'` to `admin_publique` (safety measure)
- Update the `get_user_module`, `is_restricted_module`, `can_delete_in_module`, `can_user_upload` functions to remove fiscal references

### 2. `src/types/modules.ts`
- Remove `'fiscal'` from `ClientModule` type → `'core' | 'admin_publique'`
- Remove `fiscal` entry from `MODULE_INFO`
- Remove all `isFiscalModule` logic from `getPermissionsForRoleAndModule`:
  - `canDeleteDocuments` becomes `true` for all roles (no WORM)
  - `requiresImmutability` always `false`
  - `requiresAuditLog` → `true` only for `admin_publique`
  - `isRestrictedModule` simplified to `module === 'admin_publique'`
- Remove `isFiscalModule` references from `getRestrictionReason`
- Remove `requiresImmutability` permission entirely (or always false)

### 3. `src/hooks/useModulePermissions.ts`
- Remove `isFiscalModule` property and its computation

### 4. `src/pages/ModuleSetup.tsx`
- Remove `fiscal` from `moduleDetails` and `modules` array
- Change grid from 3-column to 2-column layout
- Update Administrative module description to match spec (3 roles: Super Admin, IT Admin, User; separation of concerns; mandatory departments)

### 5. `src/components/layout/AppSidebar.tsx`
- Remove `Lock` icon import and `fiscal` case from `getModuleBadgeColor` / `getModuleIcon`

### 6. `src/components/auth/RoleAcknowledgmentModal.tsx`
- Remove fiscal-specific badge color case
- Remove WORM immutability warning section

### 7. Other files referencing fiscal
- `src/pages/MyAuthorization.tsx` — remove fiscal-specific restriction reasons
- `src/pages/OrganizationDetail.tsx` — remove fiscal badge/color if present
- `src/pages/Clients.tsx` — remove fiscal references in module display
- `src/pages/AdminPulse.tsx`, `src/pages/Settings.tsx` — check for fiscal references

### 8. Update `.lovable/plan.md`
- Replace all "Admin/Fiscal" references with just "Administrative"
- Remove fiscal-specific items (WORM, no deletion, file hash)
- Update role hierarchy diagram to show only Core and Administrative
- Rename `admin_publique` display label to "Administratif" per the spec

### 9. Database functions cleanup
- `can_delete_in_module` → simplify (always allow delete, or remove function)
- `can_user_upload` → remove fiscal check for super_admin (Super Admin cannot upload in Administrative module per spec)
- `is_restricted_module` → `module = 'admin_publique'` only

### 10. Spec alignment (in same pass)
- **Super Admin in Administrative: cannot upload** — update `can_user_upload` DB function and `getPermissionsForRoleAndModule` in types
- **IT Admin: upload only** — already partially done, verify sidebar hides everything except upload for IT Admin in Administrative
- **Core module: no IT Admin role** — already done in Users page, verify

## Files Touched
| File | Change |
|---|---|
| DB migration (new) | Remove `fiscal` from enum, update functions |
| `src/types/modules.ts` | Remove fiscal, simplify permissions |
| `src/hooks/useModulePermissions.ts` | Remove `isFiscalModule` |
| `src/pages/ModuleSetup.tsx` | Remove fiscal card, 2-col layout |
| `src/components/layout/AppSidebar.tsx` | Remove fiscal icon/color |
| `src/components/auth/RoleAcknowledgmentModal.tsx` | Remove WORM warning |
| `.lovable/plan.md` | Update to 2-module spec |
| Various pages | Remove fiscal references |

