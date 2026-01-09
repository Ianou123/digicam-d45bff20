import { 
  FileText, 
  FileImage, 
  FileSpreadsheet, 
  Presentation,
  ArrowUpRight,
  Search,
  FileSearch
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SearchResultCardProps {
  document: {
    id: string;
    title: string;
    document_type: string;
    file_size?: number | null;
    updated_at: string;
    ocr_text?: string | null;
  };
  searchQuery: string;
  matchedInContent: boolean;
  onView: (id: string) => void;
}

const documentTypeIcons: Record<string, any> = {
  pdf: FileText,
  jpg: FileImage,
  png: FileImage,
  doc: FileText,
  docx: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  ppt: Presentation,
  pptx: Presentation,
};

const documentTypeColors: Record<string, string> = {
  pdf: 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400',
  jpg: 'bg-purple-100 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
  png: 'bg-purple-100 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
  doc: 'bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  docx: 'bg-blue-100 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  xls: 'bg-green-100 text-green-600 dark:bg-green-950/30 dark:text-green-400',
  xlsx: 'bg-green-100 text-green-600 dark:bg-green-950/30 dark:text-green-400',
  ppt: 'bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400',
  pptx: 'bg-orange-100 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400',
};

// Highlight matching text
function highlightText(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => 
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

// Get snippet from OCR text around match
function getOcrSnippet(ocrText: string, query: string, contextLength: number = 50): string | null {
  if (!ocrText || !query || query.length < 2) return null;
  
  const lowerOcr = ocrText.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerOcr.indexOf(lowerQuery);
  
  if (matchIndex === -1) return null;
  
  const start = Math.max(0, matchIndex - contextLength);
  const end = Math.min(ocrText.length, matchIndex + query.length + contextLength);
  
  let snippet = ocrText.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < ocrText.length) snippet = snippet + '...';
  
  return snippet;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function SearchResultCard({
  document,
  searchQuery,
  matchedInContent,
  onView,
}: SearchResultCardProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;
  
  const Icon = documentTypeIcons[document.document_type] || FileText;
  const typeColor = documentTypeColors[document.document_type] || 'bg-gray-100 text-gray-600';
  
  const ocrSnippet = matchedInContent && document.ocr_text
    ? getOcrSnippet(document.ocr_text, searchQuery)
    : null;
  
  const formattedDate = formatDistanceToNow(new Date(document.updated_at), { 
    addSuffix: true, 
    locale: dateLocale 
  });

  return (
    <Card 
      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors group"
      onClick={() => onView(document.id)}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn('p-2 rounded-lg', typeColor)}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-foreground truncate">
              {highlightText(document.title, searchQuery)}
            </h3>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>

          {/* Found in Content Badge + Snippet */}
          {matchedInContent && ocrSnippet && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs mb-1">
                <Search className="h-3 w-3 mr-1" />
                {language === 'fr' ? 'Trouvé dans le contenu' : 'Found in Content'}
              </Badge>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {highlightText(ocrSnippet, searchQuery)}
              </p>
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>
              {language === 'fr' ? 'Mis à jour' : 'Last updated'} {formattedDate}
            </span>
            <span>•</span>
            <span className="uppercase">{document.document_type}</span>
            {document.file_size && (
              <>
                <span>•</span>
                <span>{formatFileSize(document.file_size)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
