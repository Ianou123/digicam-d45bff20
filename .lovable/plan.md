
# DigiCam Archive - Plan

## Architecture: 2 Modules

DigiCam supports **two modules** chosen at organization creation:

### Module 1: Core
- **Roles**: Admin (Super Admin), Utilisateur (Staff)
- **Description**: GED moderne pour PME, cabinets, freelances
- Admin gère tout : upload, users, départements, logs
- Utilisateur : consultation, recherche, téléchargement, envoi
- Départements optionnels

### Module 2: Administratif (admin_publique)
- **Roles**: Super Admin, Admin IT (client_admin), Utilisateur (Staff)
- **Description**: Pour institutions et grandes entreprises
- **Principe clé** : Séparation des tâches
  - Super Admin : gestion users, départements, analytics, audit logs — **NE PEUT PAS uploader**
  - Admin IT : upload documents uniquement — **NE PEUT PAS voir les documents/logs**
  - Utilisateur : consultation en lecture seule
- Départements obligatoires
- Journalisation obligatoire

### Ultra Admin (DigiCam Staff)
- Pas lié à une organisation
- Crée/gère les organisations
- Voit les logs d'audit globaux (pas le contenu des documents)
- Peut changer le module d'une organisation

## Changement de module
Le changement de module n'est PAS en libre-service. Contacter DigiCam.

## Rôles dans la base de données
- `ultra_admin` : Staff DigiCam
- `super_admin` : Responsable d'organisation
- `client_admin` : Admin IT (module Administratif uniquement)
- `staff` : Utilisateur standard

## Permissions (Résumé)

| Permission | Core Admin | Core User | Admin Super | Admin IT | Admin User | Ultra |
|---|---|---|---|---|---|---|
| Upload | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Search & Download | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Send Docs | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| Manage Depts | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| View Analytics | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| View Audit Logs | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Admin Pages | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |

## Key Technical Details
- Module enum: `client_module` = `'core' | 'admin_publique'`
- Role enum: `app_role` = `'ultra_admin' | 'super_admin' | 'client_admin' | 'staff'`
- DB function `can_user_upload()` enforces separation of concerns
- DB function `is_restricted_module()` checks `admin_publique` only
- `can_delete_in_module()` always returns true (no WORM)
