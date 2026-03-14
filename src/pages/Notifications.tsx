import { useEffect, useState } from 'react';
import { Bell, FileText, RefreshCw, Share2, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type NotificationType =
  | 'watched_search_match'
  | 'watch_match'
  | 'update_request'
  | 'trend'
  | 'document_shared'
  | 'system'
  | string;

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  metadata: {
    document_id?: string;
    document_title?: string;
    saved_search_id?: string;
    saved_search_name?: string;
  } | null;
  read: boolean;
  created_at: string;
}

const notificationIcons: Record<string, typeof Bell> = {
  watched_search_match: FileText,
  watch_match: FileText,
  update_request: RefreshCw,
  trend: TrendingUp,
  document_shared: Share2,
  system: Bell,
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const dateLocale = language === 'fr' ? fr : enUS;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setNotifications((data as unknown as Notification[]) || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications' as any)
        .update({ read: true })
        .eq('id', id);

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n)),
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await supabase
        .from('notifications' as any)
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true, locale: dateLocale });
    }
    return format(date, 'dd MMM yyyy, HH:mm', { locale: dateLocale });
  };

  const getIcon = (type: NotificationType) => {
    const Icon = notificationIcons[type] || Bell;
    return Icon;
  };

  const filteredNotifications =
    filter === 'unread'
      ? notifications.filter(n => !n.read)
      : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-semibold">
            {language === 'fr' ? 'Notifications' : 'Notifications'}
          </h2>
          <p className="text-muted-foreground">
            {language === 'fr'
              ? 'Historique complet de vos notifications'
              : 'Full history of your notifications'}
          </p>
        </div>
        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant={filter === 'all' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              {language === 'fr' ? 'Toutes' : 'All'}
            </Button>
            <Button
              variant={filter === 'unread' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setFilter('unread')}
            >
              {language === 'fr' ? 'Non lues' : 'Unread'}
              {unreadCount > 0 && (
                <Badge className="ml-2 h-5 px-1 text-xs">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Button>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                {language === 'fr' ? 'Tout marquer comme lu' : 'Mark all read'}
              </Button>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {language === 'fr' ? 'Historique' : 'History'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">
                {language === 'fr'
                  ? 'Aucune notification pour le moment'
                  : 'No notifications yet'}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y">
                {filteredNotifications.map(notification => {
                  const Icon = getIcon(notification.type);
                  const isUnread = !notification.read;

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'flex gap-3 p-4 hover:bg-muted/50 transition-colors',
                        isUnread && 'bg-primary/5',
                      )}
                    >
                      <div
                        className={cn(
                          'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                          (notification.type === 'watched_search_match' ||
                            notification.type === 'watch_match') &&
                            'bg-blue-100 text-blue-600',
                          notification.type === 'update_request' &&
                            'bg-amber-100 text-amber-600',
                          notification.type === 'trend' &&
                            'bg-green-100 text-green-600',
                          notification.type === 'document_shared' &&
                            'bg-purple-100 text-purple-600',
                          notification.type === 'system' &&
                            'bg-gray-100 text-gray-600',
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              'text-sm',
                              isUnread && 'font-semibold',
                            )}
                          >
                            {notification.title}
                          </p>
                          {isUnread && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => markAsRead(notification.id)}
                            >
                              {language === 'fr' ? 'Marquer comme lu' : 'Mark read'}
                            </Button>
                          )}
                        </div>
                        {notification.message && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.message}
                          </p>
                        )}
                        {notification.metadata?.document_title && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {language === 'fr' ? 'Document : ' : 'Document: '}
                            <span className="font-medium">
                              {notification.metadata.document_title}
                            </span>
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

