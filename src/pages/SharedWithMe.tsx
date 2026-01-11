import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Download, 
  Eye, 
  Clock, 
  Users, 
  ExternalLink,
  Inbox
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, isPast } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface SharedDocument {
  id: string;
  can_download: boolean;
  expires_at: string | null;
  created_at: string;
  created_by: string;
  document: {
    id: string;
    title: string;
    document_type: string;
    confidentiality_level: string;
    status: string;
  } | null;
  sharer_profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
}

export default function SharedWithMe() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;
  
  const [shares, setShares] = useState<SharedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'expired'>('active');

  useEffect(() => {
    if (user) {
      fetchSharedDocuments();
    }
  }, [user]);

  const fetchSharedDocuments = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('shares')
        .select('id, can_download, expires_at, created_at, created_by, document_id')
        .eq('recipient_user_id', user.id)
        .eq('share_type', 'internal')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch document details
        const documentIds = data.map(s => s.document_id);
        const sharerIds = [...new Set(data.map(s => s.created_by))];

        const [docResult, profileResult] = await Promise.all([
          supabase
            .from('documents')
            .select('id, title, document_type, confidentiality_level, status')
            .in('id', documentIds)
            .is('deleted_at', null),
          supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .in('id', sharerIds)
        ]);

        const docMap = new Map(docResult.data?.map(d => [d.id, d]) || []);
        const profileMap = new Map(profileResult.data?.map(p => [p.id, p]) || []);

        const sharesWithDetails: SharedDocument[] = data
          .filter(share => docMap.has(share.document_id)) // Only include shares with existing documents
          .map(share => ({
            ...share,
            document: docMap.get(share.document_id) || null,
            sharer_profile: profileMap.get(share.created_by) || null,
          }));

        setShares(sharesWithDetails);
      } else {
        setShares([]);
      }
    } catch (error) {
      console.error('Error fetching shared documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const isShareExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return isPast(new Date(expiresAt));
  };

  const getDocumentTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      contract: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      invoice: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      report: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      legal: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      hr: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    };
    return colors[type] || colors.other;
  };

  const activeShares = shares.filter(s => !isShareExpired(s.expires_at));
  const expiredShares = shares.filter(s => isShareExpired(s.expires_at));

  const displayedShares = activeTab === 'active' ? activeShares : expiredShares;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">
          {language === 'fr' ? 'Partagés avec moi' : 'Shared with me'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {language === 'fr' 
            ? 'Documents que vos collègues ont partagé avec vous'
            : 'Documents your colleagues have shared with you'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{shares.length}</p>
                <p className="text-xs text-muted-foreground">
                  {language === 'fr' ? 'Total partagés' : 'Total shared'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Eye className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{activeShares.length}</p>
                <p className="text-xs text-muted-foreground">
                  {language === 'fr' ? 'Actifs' : 'Active'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{expiredShares.length}</p>
                <p className="text-xs text-muted-foreground">
                  {language === 'fr' ? 'Expirés' : 'Expired'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'active' | 'expired')}>
        <TabsList>
          <TabsTrigger value="active">
            {language === 'fr' ? 'Actifs' : 'Active'} ({activeShares.length})
          </TabsTrigger>
          <TabsTrigger value="expired">
            {language === 'fr' ? 'Expirés' : 'Expired'} ({expiredShares.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {displayedShares.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>
                    {activeTab === 'active'
                      ? (language === 'fr' ? 'Aucun document partagé avec vous' : 'No documents shared with you')
                      : (language === 'fr' ? 'Aucun partage expiré' : 'No expired shares')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayedShares.map((share) => {
                const expired = isShareExpired(share.expires_at);
                
                return (
                  <Card 
                    key={share.id} 
                    className={cn(
                      "hover:shadow-md transition-shadow cursor-pointer",
                      expired && "opacity-60"
                    )}
                    onClick={() => share.document && navigate(`/documents/${share.document.id}`)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-base truncate">
                              {share.document?.title || 'Document supprimé'}
                            </CardTitle>
                            {share.document && (
                              <Badge 
                                variant="secondary" 
                                className={cn("text-xs mt-1", getDocumentTypeBadgeColor(share.document.document_type))}
                              >
                                {share.document.document_type}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            share.document && navigate(`/documents/${share.document.id}`);
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {/* Sharer info */}
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={share.sharer_profile?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(
                                share.sharer_profile?.full_name || null,
                                share.sharer_profile?.email || ''
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground truncate">
                            {share.sharer_profile?.full_name || share.sharer_profile?.email}
                          </span>
                        </div>

                        {/* Permissions and expiry */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {share.can_download ? (
                              <>
                                <Download className="h-3 w-3 mr-1" />
                                {language === 'fr' ? 'Téléchargement' : 'Download'}
                              </>
                            ) : (
                              <>
                                <Eye className="h-3 w-3 mr-1" />
                                {language === 'fr' ? 'Lecture' : 'View only'}
                              </>
                            )}
                          </Badge>
                          {share.expires_at && (
                            <Badge 
                              variant={expired ? "destructive" : "secondary"} 
                              className="text-xs"
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              {expired 
                                ? (language === 'fr' ? 'Expiré' : 'Expired')
                                : format(new Date(share.expires_at), 'dd MMM', { locale: dateLocale })
                              }
                            </Badge>
                          )}
                        </div>

                        {/* Shared date */}
                        <p className="text-xs text-muted-foreground">
                          {language === 'fr' ? 'Partagé le' : 'Shared on'}{' '}
                          {format(new Date(share.created_at), 'dd MMM yyyy', { locale: dateLocale })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
