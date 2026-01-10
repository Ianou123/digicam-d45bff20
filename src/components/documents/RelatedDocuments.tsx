import { useState, useEffect } from 'react';
import { FileText, Link2, TrendingUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface RelatedDocument {
  id: string;
  title: string;
  document_type: string;
  confidentiality_level: string;
  relation_type: 'co_viewed' | 'same_tags';
  score: number;
}

interface RelatedDocumentsProps {
  documentId: string;
  documentTags?: string[];
  className?: string;
}

const confidentialityColors: Record<string, string> = {
  public: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  internal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  confidential: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function RelatedDocuments({ documentId, documentTags = [], className }: RelatedDocumentsProps) {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const [relatedDocs, setRelatedDocs] = useState<RelatedDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (documentId && profile?.client_id) {
      fetchRelatedDocuments();
    }
  }, [documentId, profile?.client_id]);

  const fetchRelatedDocuments = async () => {
    if (!profile?.client_id) return;

    setLoading(true);
    try {
      const relatedDocuments: RelatedDocument[] = [];

      // 1. Fetch documents with same tags
      if (documentTags.length > 0) {
        const { data: tagMatches } = await supabase
          .from('documents')
          .select('id, title, document_type, confidentiality_level, tags')
          .eq('client_id', profile.client_id)
          .is('deleted_at', null)
          .neq('id', documentId)
          .overlaps('tags', documentTags)
          .limit(5);

        if (tagMatches) {
          tagMatches.forEach(doc => {
            // Calculate score based on number of matching tags
            const matchingTags = doc.tags?.filter((t: string) => documentTags.includes(t)) || [];
            relatedDocuments.push({
              id: doc.id,
              title: doc.title,
              document_type: doc.document_type,
              confidentiality_level: doc.confidentiality_level,
              relation_type: 'same_tags',
              score: matchingTags.length,
            });
          });
        }
      }

      // 2. Fetch documents from co-viewing patterns (from document_relations table)
      const { data: coViewedDocs } = await supabase
        .from('document_relations' as any)
        .select(`
          related_document_id,
          score,
          documents:related_document_id(id, title, document_type, confidentiality_level)
        `)
        .eq('document_id', documentId)
        .eq('relation_type', 'co_viewed')
        .order('score', { ascending: false })
        .limit(5);

      if (coViewedDocs) {
        (coViewedDocs as any[]).forEach((rel: any) => {
          if (rel.documents && !relatedDocuments.find(d => d.id === rel.documents.id)) {
            relatedDocuments.push({
              id: rel.documents.id,
              title: rel.documents.title,
              document_type: rel.documents.document_type,
              confidentiality_level: rel.documents.confidentiality_level,
              relation_type: 'co_viewed',
              score: rel.score,
            });
          }
        });
      }

      // 3. Also check for users who viewed this document, what else did they view?
      if (relatedDocuments.length < 5) {
        const { data: viewLogs } = await supabase
          .from('activity_logs')
          .select('user_id')
          .eq('document_id', documentId)
          .eq('action_type', 'view')
          .limit(50);

        if (viewLogs && viewLogs.length > 0) {
          const userIds = [...new Set(viewLogs.map(l => l.user_id))];
          
          const { data: otherViews } = await supabase
            .from('activity_logs')
            .select('document_id, documents(id, title, document_type, confidentiality_level)')
            .in('user_id', userIds)
            .eq('action_type', 'view')
            .neq('document_id', documentId)
            .not('document_id', 'is', null)
            .limit(20);

          if (otherViews) {
            // Count occurrences
            const docCounts: Record<string, { doc: any; count: number }> = {};
            otherViews.forEach((log: any) => {
              if (log.documents && !relatedDocuments.find(d => d.id === log.documents.id)) {
                if (!docCounts[log.documents.id]) {
                  docCounts[log.documents.id] = { doc: log.documents, count: 0 };
                }
                docCounts[log.documents.id].count++;
              }
            });

            // Add top co-viewed
            Object.entries(docCounts)
              .sort((a, b) => b[1].count - a[1].count)
              .slice(0, 5 - relatedDocuments.length)
              .forEach(([id, data]) => {
                relatedDocuments.push({
                  id,
                  title: data.doc.title,
                  document_type: data.doc.document_type,
                  confidentiality_level: data.doc.confidentiality_level,
                  relation_type: 'co_viewed',
                  score: data.count,
                });
              });
          }
        }
      }

      // Sort by score and deduplicate
      const uniqueDocs = relatedDocuments.reduce((acc, doc) => {
        const existing = acc.find(d => d.id === doc.id);
        if (!existing) {
          acc.push(doc);
        } else if (doc.score > existing.score) {
          acc[acc.indexOf(existing)] = doc;
        }
        return acc;
      }, [] as RelatedDocument[]);

      setRelatedDocs(uniqueDocs.sort((a, b) => b.score - a.score).slice(0, 5));
    } catch (error) {
      console.error('Error fetching related documents:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (relatedDocs.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          {language === 'fr' ? 'Documents associés' : 'Related Documents'}
        </CardTitle>
        <CardDescription className="text-xs">
          {language === 'fr' 
            ? 'Fréquemment consultés ensemble'
            : 'Frequently viewed together'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {relatedDocs.map(doc => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/documents/${doc.id}`)}
            >
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                    {doc.document_type.toUpperCase()}
                  </Badge>
                  <Badge className={cn('text-[10px] px-1 py-0 h-4', confidentialityColors[doc.confidentiality_level])}>
                    {doc.confidentiality_level}
                  </Badge>
                  {doc.relation_type === 'same_tags' && (
                    <span className="text-[10px] text-muted-foreground">
                      • {doc.score} tag{doc.score > 1 ? 's' : ''} {language === 'fr' ? 'en commun' : 'in common'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}