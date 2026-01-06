import { Search, Filter, X, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';

interface FilterState {
  search: string;
  department: string;
  type: string;
  year: string;
  confidentiality: string;
}

interface DocumentFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  departments: { id: string; name: string; archived_at?: string | null }[];
  searchHistory?: string[];
  onSearchHistoryClick?: (query: string) => void;
}

const documentTypes = ['pdf', 'jpg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => (currentYear - i).toString());

export function DocumentFilters({ filters, onFiltersChange, departments, searchHistory = [], onSearchHistoryClick }: DocumentFiltersProps) {
  const { t } = useLanguage();

  const updateFilter = (key: keyof FilterState, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      department: '',
      type: '',
      year: '',
      confidentiality: '',
    });
  };

  const activeFilterCount = Object.values(filters).filter(v => v && v !== '').length;

  return (
    <div className="space-y-4">
      {/* Prominent Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder={t('documents.searchPlaceholder')}
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="pl-12 h-12 text-base border-2 focus:border-primary shadow-sm"
        />
      </div>

      {/* Search History */}
      {searchHistory.length > 0 && !filters.search && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{t('documents.recentSearches')}:</span>
          </div>
          {searchHistory.map((query, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 transition-colors"
              onClick={() => onSearchHistoryClick?.(query)}
            >
              {query}
            </Badge>
          ))}
        </div>
      )}
      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Filtres:</span>
        </div>

        <Select
          value={filters.department || 'all'}
          onValueChange={(v) => updateFilter('department', v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder={t('documents.filterByDepartment')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('documents.allDepartments')}</SelectItem>
            <SelectItem value="unassigned">{t('documents.unassigned') || 'Non assigné'}</SelectItem>
            {/* Show all departments in filters (including archived) so users can filter existing docs */}
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name} {dept.archived_at ? '(archivé)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.type || 'all'}
          onValueChange={(v) => updateFilter('type', v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder={t('documents.filterByType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('documents.allTypes')}</SelectItem>
            {documentTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.year || 'all'}
          onValueChange={(v) => updateFilter('year', v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-[120px] h-9">
            <SelectValue placeholder={t('documents.filterByYear')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('documents.allYears')}</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.confidentiality || 'all'}
          onValueChange={(v) => updateFilter('confidentiality', v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder={t('documents.filterByConfidentiality')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('documents.allLevels')}</SelectItem>
            <SelectItem value="public">{t('documents.public')}</SelectItem>
            <SelectItem value="internal">{t('documents.internal')}</SelectItem>
            <SelectItem value="confidential">{t('documents.confidential')}</SelectItem>
          </SelectContent>
        </Select>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Effacer ({activeFilterCount})
          </Button>
        )}
      </div>
    </div>
  );
}