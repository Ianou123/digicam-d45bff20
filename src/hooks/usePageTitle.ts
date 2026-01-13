import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

const BASE_TITLE = 'DigiCam';

interface PageTitleOptions {
  /** Custom title to append (e.g., document name) */
  customTitle?: string;
}

/**
 * Hook to dynamically update the browser tab title based on the current route
 */
export function usePageTitle(options?: PageTitleOptions) {
  const location = useLocation();
  const { language } = useLanguage();

  useEffect(() => {
    const getPageTitle = (): string => {
      // If custom title is provided, use it
      if (options?.customTitle) {
        return `${options.customTitle} | ${BASE_TITLE}`;
      }

      // Map routes to titles
      const routeTitles: Record<string, { fr: string; en: string }> = {
        '/': { fr: 'Tableau de bord', en: 'Dashboard' },
        '/dashboard': { fr: 'Tableau de bord', en: 'Dashboard' },
        '/my-dashboard': { fr: 'Mon tableau de bord', en: 'My Dashboard' },
        '/documents': { fr: 'Documents', en: 'Documents' },
        '/shared-with-me': { fr: 'Partagés avec moi', en: 'Shared with me' },
        '/activity': { fr: 'Activité', en: 'Activity' },
        '/analytics': { fr: 'Analyses', en: 'Analytics' },
        '/users': { fr: 'Utilisateurs', en: 'Users' },
        '/departments': { fr: 'Départements', en: 'Departments' },
        '/clients': { fr: 'Organisations', en: 'Organizations' },
        '/settings': { fr: 'Paramètres', en: 'Settings' },
        '/audit-logs': { fr: 'Journaux d\'audit', en: 'Audit Logs' },
        '/admin-pulse': { fr: 'Admin Pulse', en: 'Admin Pulse' },
        '/upload': { fr: 'Téléverser', en: 'Upload' },
        '/auth': { fr: 'Connexion', en: 'Login' },
      };

      const pathname = location.pathname;

      // Check for exact match first
      if (routeTitles[pathname]) {
        return `${routeTitles[pathname][language]} | ${BASE_TITLE}`;
      }

      // Check for pattern matches (e.g., /documents/:id)
      if (pathname.startsWith('/documents/') && pathname.includes('/edit')) {
        return `${language === 'fr' ? 'Modifier le document' : 'Edit Document'} | ${BASE_TITLE}`;
      }

      if (pathname.startsWith('/documents/')) {
        // Document detail page - title will be set by the page component
        return BASE_TITLE;
      }

      if (pathname.startsWith('/organizations/') || pathname.startsWith('/clients/')) {
        return `${language === 'fr' ? 'Organisation' : 'Organization'} | ${BASE_TITLE}`;
      }

      // Default fallback
      return BASE_TITLE;
    };

    document.title = getPageTitle();
  }, [location.pathname, language, options?.customTitle]);
}

/**
 * Sets a custom page title directly (useful for pages that fetch data)
 */
export function setPageTitle(title: string) {
  document.title = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE;
}
