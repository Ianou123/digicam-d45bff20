## DigiCam – Project Context

### Vision & Target
- **Product**: DigiCam – document management system (DMS) with OCR.
- **Target users**:
  - **Core module**: SMBs, firms, internal teams (B2B).
  - **Administrative module**: administrations and large institutions in Africa, especially **Cameroon / UEMOA** (B2G / large enterprise).
- **Positioning**:
  - Focus on **confidentiality**, **traceability**, and **accessibility** of documents.
  - Designed for the realities of African administrations and enterprises (paper-heavy processes, sovereignty concerns, mixed digital maturity).

### High-level Architecture
- **Frontend**: React + TypeScript + Vite, shadcn/Radix UI, Tailwind CSS.
  - Routing with `react-router-dom`, layouts via `AppLayout`.
  - Data fetching with `@tanstack/react-query`.
- **Backend / data**: Supabase
  - **Postgres**: core tables like `documents`, `document_versions`, `activity_logs`, `search_logs`, `clients`, `profiles`, `user_roles`, `departments`, `shares`, `notifications`, etc.
  - **Auth**: Supabase auth; `profiles` linked to Supabase users.
  - **Storage**: private `documents` bucket accessed via **signed URLs** only.
  - **Edge functions**: used selectively (e.g. user deletion), but most logic is frontend + PostgREST + RLS.
- **Security model**:
  - Heavy use of **Row Level Security (RLS)** with helper functions (`is_ultra_admin`, `is_super_admin`, `is_client_admin`, `get_user_client_id`, etc.).
  - Storage bucket `documents` is **private**, with storage policies enforcing per-client access.

### Modules & Roles
#### Modules
- `ClientModule = 'core' | 'admin_publique'` (see `src/types/modules.ts`).
- **Core module**:
  - Simpler, 2 main client roles: Admin + User.
  - Departments optional.
  - Admin manages uploads, users, logs.
- **Administrative (`admin_publique`) module**:
  - 3 roles: **Super Admin**, **IT Admin (client_admin)**, **User**.
  - **Separation of duties**:
    - Super Admin manages users/departments/logs but does **not** upload documents.
    - IT Admin uploads documents but has limited admin/search powers.
    - Users are read-only (consult/search/download), cannot upload.
  - Departments mandatory; more emphasis on logging and approvals.

#### Roles
- `AppRole = 'ultra_admin' | 'super_admin' | 'client_admin' | 'staff'`.
- **Ultra Admin**:
  - DigiCam staff – **platform level**.
  - Can manage organizations (`clients`), profiles, roles, and see global metrics/logs.
  - **Confidentiality constraint**: Ultra Admin **must never access client document content**.
    - **Enforced in code**:
      - Permission matrix: `getPermissionsForRoleAndModule` returns `canViewDocuments = false` for `ultra_admin`.
      - UI/routing: Ultra Admin is redirected away from documents routes (`/documents`, `/documents/:id`, `/shared-with-me`, `/my-documents`, upload, edit, etc.).
    - **Enforced in DB**:
      - RLS migration `20260314120000_deny_ultra_admin_documents.sql` drops the previous “Ultra admins can see all documents” policy.
      - Updated storage policies on `storage.objects` for the `documents` bucket disallow ultra_admin reading/uploading/deleting objects.
- **Super Admin**:
  - Organization head (CIO, DG…).
  - Manages users, roles, departments, organization-level settings, and logs.
  - In **admin_publique**: cannot upload (separation of duties).
- **Client Admin (IT Admin)**:
  - Document operator and technical admin.
  - In **core**: full admin on documents + some org configuration.
  - In **admin_publique**: **upload-only** role; cannot manage users/roles and has restricted search/admin powers.
- **Staff (User)**:
  - Read-only: search, consult, download according to confidentiality rules.
  - No upload or admin features.

### Key Flows
#### Document Lifecycle
- **Upload**:
  - Entry via `/upload` (guards: `canManageDocuments`, client not suspended, Super Admin blocked in admin module, Ultra Admin blocked globally).
  - `UploadModal` handles:
    - File upload to Supabase storage (`documents` bucket, path `client_id/timestamp_title.ext`).
    - `documents` row insert with metadata: title, department, confidentiality (`public/internal/confidential`), tags, `ocr_text` (optional), file path/size, `status = 'processing'`.
    - Activity log entry (`activity_logs`, action `upload`).
    - Simulated OCR: progress UI + final `status` update to `ready`.
- **Validation / status** (in Document Detail):
  - Statuses: `processing`, `ready`, `pending_validation`, `rejected`, `archived`.
  - Admin actions (depending on permissions):
    - Validate → `ready`.
    - Reject with reason → `rejected`.
    - Resubmit → `pending_validation`.
    - Propose modification → `pending_validation` with comment.
    - Archive → `archived`.
  - All important actions logged in `activity_logs` with metadata.
- **Versions**:
  - New versions uploaded from `DocumentEdit`:
    - Enforce same file type as original.
    - Store in `document_versions` with `version_number`, `file_url`, `file_size`, `uploaded_by`, `change_notes`.
    - Update `documents.current_version`, `file_url`, `file_size`.
    - Log version change in `activity_logs`.
  - UI shows current + previous versions with uploader name and notes.

#### Search & Analytics
- **Documents search** (`/documents`):
  - Server-side filter: `title` + `ocr_text` `ilike`, filters by department, year, type, confidentiality, status, owner, trash vs active.
  - Client-side strict filter to avoid fuzzy false positives (term must appear in title/OCR/tags).
  - Search logs:
    - `activity_logs` logs every search (`action_type = 'search'`).
    - `search_logs` logs query text, result count, and optional clicked document for analytics.
- **Per-document OCR tab**:
  - Displays `ocr_text` with an inline search box + highlight + copy.

### OCR Strategy & Future Infrastructure (Roadmap)
- **Current state**:
  - OCR is **simulated**: `simulateOcrProcessing` just updates `status` from `processing` to `ready`.
  - `ocr_text` is optional and provided manually at upload or edit; no external OCR service is invoked yet.
- **Intended architecture**:
  - Introduce an internal `requestOcr(documentId)` abstraction that:
    - Enqueues OCR work (Supabase function or external worker).
    - Updates `documents.ocr_text` + `status` when processing finishes.
  - Allow different OCR backends by deployment:
    - **Cloud SaaS (Core module / SMB)**: use a cloud OCR provider (e.g. external API) where allowed.
    - **On-prem / local DC (Administrative / B2G)**: use self-hosted OCR (e.g. Tesseract or provider in local datacenter), so documents never leave the jurisdiction/network.
- **Multi-deployment story**:
  - Plan to support:
    - **Full SaaS**: DB + storage + OCR in a regional cloud for SMBs.
    - **“Private SaaS” / local DC**: DB + object storage in a local datacenter for administrations.
    - **On-prem**: DB + object storage + OCR hosted inside client infrastructure.
  - Code should keep storage/OCR behind clear interfaces to swap Supabase storage for S3/MinIO/etc. later.

### Data Sovereignty & Compliance
- **Data location**:
  - Today: Supabase-hosted DB + storage (region depends on Supabase project).
  - Future: explicit per-client `hosting_model` / `data_location` (e.g. `cloud-eu`, `local-dc-cm`, `on-prem`) to drive deployment and sales/compliance.
- **Confidentiality guarantees**:
  - Ultra Admin (DigiCam staff) cannot access document content (enforced in both app and RLS).
  - Clients are isolated by `client_id` in RLS for `documents`, `activity_logs`, `search_logs`, `departments`, `tags`, etc.
- **Traceability**:
  - `activity_logs` record most actions: search, view, download, upload, update, delete; specialized logs for validations, rejections, resubmissions, etc.
  - Additional immutable logs and audit tables for admin/super-admin actions.
- **Health / “Rapport Santé” (AdminPulse)**:
  - Computed in `AdminPulse` from:
    - **StorageScore**: volume of non-deleted documents (capped).
    - **Search success rate**: successful searches / total searches over a period.
    - **User adoption**: active users / total users (active = any activity in last 30 days).
  - Health score ∈ [0, 100], with textual guidance:
    - ≥ 80: Excellent – keep feeding the archive and training teams.
    - 60–79: Needs improvement – import missing docs for failed searches, increase usage in low-activity departments.
    - < 60: Action required – fix failed searches and support users so they log in and consult more.

### Notifications
- Realtime and historical notifications exist via a `notifications` table and:
  - **Bell popover** (`NotificationCenter`): shows latest notifications and unread counter.
  - **Notifications page** (`/notifications`): full history with All / Unread filters, “Mark all as read”.
  - Types include: watched search matches, update requests, trends, document shares, and system messages.

### UX & Branding Notes
- **Languages**: FR and EN supported via `LanguageContext`; FR is primary for admin-facing copy.
- **Branding**:
  - Tagline around the product:  
    - “Pensé pour les entreprises et administrations africaines” / “Built for African businesses and administrations”.
    - “Digitalisez, recherchez et sécurisez vos documents” / “Digitalize, search and secure your documents”.
- **Key screens**:
  - **Dashboard** variants for:
    - Ultra Admin (platform control center).
    - Client admins / super admins (org overview).
    - Staff users (personal dashboard).
  - **AdminPulse**: “Rapport Santé” and usage intelligence for admins.

### Maintenance Guidelines for This File
- **When to update**:
  - Whenever architecture, roles/permissions, deployment strategy, or core flows change.
  - After adding significant features (e.g. real OCR integration, new modules, new role types, major RBAC or RLS changes).
  - After deciding or implementing new deployment/hosting models (cloud vs local DC vs on-prem).
- **How to use in new chats**:
  - On every new Cursor chat for DigiCam, **read `DIGICAM_CONTEXT.md` first** and treat it as the source of truth for:
    - Architecture
    - Roles/modules and constraints
    - Security/compliance expectations
    - Planned infra/OCR roadmap

