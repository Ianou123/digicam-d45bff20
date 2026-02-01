
# DigiCam Archive - Module-Based Architecture Implementation Plan

## Executive Summary

This plan transforms DigiCam from a single-mode document management system into a **module-based platform** with three distinct operational modes: **Core**, **Administration Publique**, and **Fiscal**. Each module progressively restricts functionality to match institutional governance requirements.

---

## Current State Analysis

### Existing Architecture
- **Roles**: `super_admin`, `client_admin`, `staff` (stored in `user_roles` table)
- **Multi-tenancy**: Organizations (clients) with departments
- **Permissions**: RLS policies based on role + client_id
- **Documents**: Single department assignment, confidentiality levels (public/internal/confidential)

### Gap Analysis
| Feature | Current | Required |
|---------|---------|----------|
| Module Selection | Not exists | Core/Admin/Fiscal per organization |
| Role System | 3 roles (super_admin, client_admin, staff) | Keep 3 roles, but behavior changes per module |
| Department Assignment | 1 department per user | N departments (tags) for Admin/Fiscal modules |
| Document Restrictions | Staff can upload if client_admin | Staff is read-only in Admin/Fiscal modules |
| Immutability | Soft delete supported | WORM required for Fiscal module |
| Rights Transparency | None | "My Authorization" page required |
| Onboarding | Basic invite code | Module selection + role explanation flow |

---

## Implementation Phases

### Phase 1: Database Schema Updates

**1.1 Add Module to Clients Table**
```sql
-- Add module type enum
CREATE TYPE client_module AS ENUM ('core', 'admin_publique', 'fiscal');

-- Add module column to clients
ALTER TABLE clients ADD COLUMN module client_module NOT NULL DEFAULT 'core';
```

**1.2 User-Department Many-to-Many Relationship**
For Admin/Fiscal modules, users need to be associated with multiple departments.

```sql
-- Create junction table for user-department relationships
CREATE TABLE user_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id)
);

-- Enable RLS
ALTER TABLE user_departments ENABLE ROW LEVEL SECURITY;
```

**1.3 Document-Department Many-to-Many Relationship**
Documents also need multiple department tags in Admin/Fiscal modules.

```sql
-- Create junction table for document-department relationships
CREATE TABLE document_departments (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, department_id)
);

-- Enable RLS
ALTER TABLE document_departments ENABLE ROW LEVEL SECURITY;
```

**1.4 Audit Log Enhancements for Fiscal Module**
```sql
-- Add read logging for fiscal module
ALTER TABLE activity_logs ADD COLUMN context JSONB DEFAULT '{}';

-- Create immutable document log for fiscal module
CREATE TABLE document_immutable_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  action TEXT NOT NULL, -- 'create', 'version', 'purge_request'
  actor_id UUID NOT NULL,
  justification TEXT, -- Required for purge requests
  file_hash TEXT, -- SHA-256 hash for integrity verification
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Make this table append-only (no UPDATE/DELETE RLS)
ALTER TABLE document_immutable_log ENABLE ROW LEVEL SECURITY;
```

**1.5 Role Acknowledgment Table**
```sql
-- Track role change acknowledgments
CREATE TABLE role_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  module client_module NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, module)
);
```

---

### Phase 2: Helper Functions and RLS Updates

**2.1 Module Detection Functions**
```sql
-- Get client module for a user
CREATE OR REPLACE FUNCTION get_user_module(_user_id UUID)
RETURNS client_module
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.module 
  FROM clients c
  JOIN profiles p ON p.client_id = c.id
  WHERE p.id = _user_id
$$;

-- Check if user's organization uses Admin/Fiscal module
CREATE OR REPLACE FUNCTION is_restricted_module(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT get_user_module(_user_id) IN ('admin_publique', 'fiscal')
$$;
```

**2.2 Department Access Functions**
```sql
-- Check if user has access to department (via user_departments for restricted modules)
CREATE OR REPLACE FUNCTION user_has_department_access(_user_id UUID, _department_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    CASE 
      WHEN is_restricted_module(_user_id) THEN
        EXISTS (
          SELECT 1 FROM user_departments 
          WHERE user_id = _user_id AND department_id = _department_id
        )
      ELSE
        -- Core module: department_id on profile (existing behavior)
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE id = _user_id AND department_id = _department_id
        )
    END
$$;
```

**2.3 Document Visibility Updates**
```sql
-- Update documents RLS to respect module rules
DROP POLICY IF EXISTS "Users can see documents based on confidentiality" ON documents;

CREATE POLICY "Users can see documents based on module and confidentiality"
  ON documents FOR SELECT
  USING (
    client_id = get_user_client_id(auth.uid())
    AND (
      -- Super admin sees all
      is_super_admin(auth.uid())
      -- Client admin sees all in org
      OR is_client_admin(auth.uid())
      -- For restricted modules: staff sees public OR documents in their departments
      OR (
        is_restricted_module(auth.uid())
        AND (
          confidentiality_level = 'public'
          OR EXISTS (
            SELECT 1 FROM document_departments dd
            JOIN user_departments ud ON ud.department_id = dd.department_id
            WHERE dd.document_id = documents.id 
            AND ud.user_id = auth.uid()
          )
        )
      )
      -- For core module: existing behavior
      OR (
        NOT is_restricted_module(auth.uid())
        AND (
          confidentiality_level IN ('public', 'internal')
          OR (confidentiality_level = 'confidential' AND uploaded_by = auth.uid())
          OR user_has_document_share(auth.uid(), id)
        )
      )
    )
  );
```

**2.4 Fiscal Module Write Prevention**
```sql
-- Prevent document deletion in fiscal module
CREATE POLICY "Fiscal module prevents deletion"
  ON documents FOR DELETE
  USING (
    NOT (get_user_module(auth.uid()) = 'fiscal')
    AND (
      is_super_admin(auth.uid()) 
      OR (is_client_admin(auth.uid()) AND client_id = get_user_client_id(auth.uid()))
    )
    AND NOT is_client_suspended(auth.uid())
  );
```

---

### Phase 3: Frontend Implementation

**3.1 New Types and Context Updates**

```text
src/types/modules.ts (new file)
- ClientModule type: 'core' | 'admin_publique' | 'fiscal'
- ModulePermissions interface defining what each role can do per module
- Permission matrix constants
```

**3.2 AuthContext Enhancements**
```text
src/contexts/AuthContext.tsx (updates)
- Add clientModule to context state
- Add computed permissions based on module + role:
  - canUpload: false for staff in Admin/Fiscal modules
  - canDelete: false for everyone in Fiscal module  
  - canModify: false for staff in Admin/Fiscal modules
  - isReadOnly: true for staff in Admin/Fiscal modules
- Add requiresRoleAcknowledgment check
```

**3.3 My Authorization Page (New)**
```text
src/pages/MyAuthorization.tsx (new file)
- Display current role with icon
- Show assigned departments (as tags)
- Permission matrix:
  ✅ What I can do (with explanations)
  ❌ What I cannot do (with reasons)
- "Report authorization inconsistency" button -> sends notification to Super Admin
- Module-specific explanations
```

**3.4 Role Acknowledgment Modal (New)**
```text
src/components/auth/RoleAcknowledgmentModal.tsx (new file)
- Triggered on login if role changed or first login with restricted module
- Shows: role name, responsibilities, permissions matrix
- "I understand and accept" button required before proceeding
- Saves acknowledgment to database
```

**3.5 Organization Directory (New for Admin/Fiscal)**
```text
src/pages/Directory.tsx (new file)
- Visible only in Admin/Fiscal modules
- Shows organizational structure
- Lists all users with their departments and roles
- Search/filter by department
- Read-only for all users
```

**3.6 Module Selection for Super Admin (Organization Creation)**
```text
src/pages/OrganizationDetail.tsx (update)
- Add module selection when creating organization
- Show current module with explanation
- "Request module change" for existing orgs (sends notification)
```

**3.7 Sidebar Updates**
```text
src/components/layout/AppSidebar.tsx (update)
- Add "My Authorization" link for all users
- Add "Directory" link for Admin/Fiscal modules
- Conditionally hide Upload link for read-only users
- Show module badge near organization name
```

**3.8 Document Pages Updates**
```text
src/pages/Documents.tsx (update)
- Hide upload button for read-only users
- Hide edit/delete actions for read-only users
- Add department tags display for Admin/Fiscal modules
- Multiple department filter for Admin/Fiscal

src/pages/DocumentDetail.tsx (update)
- Show department tags instead of single department
- Hide edit button for read-only users
- For Fiscal: show immutability badge and version history prominently

src/components/documents/UploadModal.tsx (update)
- Support multiple department selection for Admin/Fiscal
- Add fiscal-specific warnings about immutability
```

**3.9 Admin Restrictions**
```text
src/pages/Users.tsx (update)
- For Admin IT role (client_admin in Admin/Fiscal):
  - Hide user management controls
  - Show read-only user list
- Only Super Admin can manage users in restricted modules

src/pages/Departments.tsx (update)  
- Only Super Admin can create/archive departments in Admin/Fiscal
- Client Admin (Admin IT) is read-only for department structure
```

---

### Phase 4: Fiscal Module Specifics

**4.1 WORM Storage Pattern**
```text
- Documents cannot be overwritten - each edit creates new version
- Delete operation is completely blocked
- Purge request flow (Super Admin only):
  1. Request purge with mandatory justification
  2. Log request to immutable_log
  3. Actual purge requires DigiCam Ultra Admin approval (out of scope - external process)
```

**4.2 Enhanced Audit Logging**
```text
- Log every document view with context
- Log search queries
- Log download attempts
- All logs are append-only, cannot be modified
```

**4.3 File Integrity**
```text
- Store SHA-256 hash of files
- Display hash in document detail for verification
- Version comparison shows integrity status
```

---

### Phase 5: UI/UX Refinements

**5.1 Module Indicator**
- Badge in sidebar showing current module
- Color coding: Core (neutral), Admin (blue), Fiscal (amber with lock icon)

**5.2 Read-Only Mode Visual Cues**
- Consistent "View Only" badges on restricted elements
- Grayed out action buttons with tooltips explaining why
- Info banners explaining module restrictions

**5.3 Onboarding Flow**
- First Super Admin of new org selects module during setup
- Clear explanation of module implications
- Role acknowledgment before first use

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `src/types/modules.ts` | Module types and permission matrix |
| `src/pages/MyAuthorization.tsx` | User's permissions page |
| `src/pages/Directory.tsx` | Organization directory |
| `src/components/auth/RoleAcknowledgmentModal.tsx` | Role change acknowledgment |
| `src/hooks/useModulePermissions.ts` | Permission checking hook |

### Modified Files
| File | Changes |
|------|---------|
| `src/contexts/AuthContext.tsx` | Add module, permissions, acknowledgment check |
| `src/components/layout/AppSidebar.tsx` | Add new nav items, module badge |
| `src/components/layout/AppLayout.tsx` | Add acknowledgment modal trigger |
| `src/pages/Documents.tsx` | Multi-department, read-only mode |
| `src/pages/DocumentDetail.tsx` | Multi-department, fiscal specifics |
| `src/pages/Users.tsx` | Role-based restrictions |
| `src/pages/Departments.tsx` | Module-based management |
| `src/pages/OrganizationDetail.tsx` | Module selection |
| `src/pages/Settings.tsx` | Multi-department self-declaration |
| `src/App.tsx` | Add new routes |

### Database Migrations
| Migration | Purpose |
|-----------|---------|
| Add module enum and column | Enable module selection |
| Create user_departments table | User-department M:N |
| Create document_departments table | Document-department M:N |
| Create role_acknowledgments table | Track acknowledgments |
| Create document_immutable_log table | Fiscal audit trail |
| Update RLS policies | Module-aware access control |

---

## Implementation Order

1. **Database First**: Create all new tables and functions
2. **AuthContext**: Add module awareness
3. **Permission Hook**: Create `useModulePermissions`
4. **My Authorization Page**: Core transparency feature
5. **Read-Only Mode**: Update Document pages
6. **Role Acknowledgment**: Add modal and flow
7. **Multi-Department**: Update department handling
8. **Directory**: Organization visibility
9. **Fiscal Specifics**: Immutability and audit
10. **Testing**: Comprehensive test scenarios

---

## Technical Notes

### Backward Compatibility
- Core module is default - existing orgs continue unchanged
- Single department_id on profiles/documents remains for Core module
- New M:N tables used only for Admin/Fiscal modules

### Security Considerations
- All module checks use SECURITY DEFINER functions
- RLS policies prevent client-side bypass
- Fiscal immutability enforced at database level
- Audit logs are append-only

### Performance
- Add indexes on new junction tables
- Module detection function is cached per session
- Minimal query overhead for permission checks
