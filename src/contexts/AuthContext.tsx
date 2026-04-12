import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { ClientModule } from '@/types/modules';

// App role now includes ultra_admin for DigiCam staff
type AppRole = 'ultra_admin' | 'super_admin' | 'client_admin' | 'staff';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  client_id: string | null;
  preferred_language: 'fr' | 'en';
  status: 'active' | 'deactivated';
  department_id: string | null;
  department_notifications: boolean;
  department_self_declared: boolean;
}

type ClientStatus = 'active' | 'inactive' | 'suspended';

interface ClientInfo {
  name: string | null;
  status: ClientStatus | null;
  inviteCode: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  roles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, inviteCode?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  // Role checks
  isUltraAdmin: boolean;  // DigiCam staff - platform level
  isSuperAdmin: boolean;  // Organization head
  isClientAdmin: boolean; // Admin IT
  isStaff: boolean;       // Regular user
  canManageDocuments: boolean;
  refreshProfile: () => Promise<void>;
  clientStatus: ClientStatus | null;
  clientName: string | null;
  clientInviteCode: string | null;
  isClientSuspended: boolean;
  isUserDeactivated: boolean;
  // Module-based architecture
  clientModule: ClientModule | null;
  moduleConfigured: boolean;
  requiresRoleAcknowledgment: boolean;
  acknowledgeRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientStatus, setClientStatus] = useState<ClientStatus | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [clientInviteCode, setClientInviteCode] = useState<string | null>(null);
  const [clientModule, setClientModule] = useState<ClientModule | null>(null);
  const [moduleConfigured, setModuleConfigured] = useState(true);
  const [requiresRoleAcknowledgment, setRequiresRoleAcknowledgment] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return;
      }

      if (profileData) {
        setProfile({
          id: profileData.id,
          email: profileData.email,
          full_name: profileData.full_name,
          avatar_url: profileData.avatar_url,
          client_id: profileData.client_id,
          preferred_language: (profileData.preferred_language as 'fr' | 'en') || 'fr',
          status: (profileData.status as 'active' | 'deactivated') || 'active',
          department_id: profileData.department_id || null,
          department_notifications: profileData.department_notifications ?? true,
          department_self_declared: profileData.department_self_declared ?? false,
        });

        // Fetch client status, name, invite code, and module if user has a client
        if (profileData.client_id) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('status, name, invite_code, module, module_configured')
            .eq('id', profileData.client_id)
            .maybeSingle();

          if (clientData) {
            setClientStatus(clientData.status as ClientStatus);
            setClientName(clientData.name);
            setClientInviteCode(clientData.invite_code);
            setClientModule(clientData.module as ClientModule);
            setModuleConfigured(clientData.module_configured ?? true);
          }
        } else {
          setClientStatus(null);
          setClientName(null);
          setClientInviteCode(null);
          setClientModule(null);
        }
      }

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        return;
      }

      if (rolesData) {
        const userRoles = rolesData.map(r => r.role as AppRole);
        setRoles(userRoles);

        // Check if role acknowledgment is required for restricted modules
        // Ultra admins don't need acknowledgment - they're DigiCam staff
        if (profileData?.client_id && !userRoles.includes('ultra_admin')) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('module')
            .eq('id', profileData.client_id)
            .maybeSingle();

          const module = clientData?.module as ClientModule;
          if (module && module === 'admin_publique') {
            const currentRole = userRoles.includes('super_admin')
              ? 'super_admin'
              : userRoles.includes('client_admin')
                ? 'client_admin'
                : 'staff';

            // Check if user has acknowledged this role+module combination
            const { data: ackData } = await supabase
              .from('role_acknowledgments')
              .select('id')
              .eq('user_id', userId)
              .eq('role', currentRole)
              .eq('module', module)
              .maybeSingle();

            setRequiresRoleAcknowledgment(!ackData);
          } else {
            setRequiresRoleAcknowledgment(false);
          }
        } else {
          setRequiresRoleAcknowledgment(false);
        }
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
        }

        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setRoles([]);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, inviteCode?: string) => {
    const redirectUrl = `${window.location.origin}/`;

    if (inviteCode?.trim()) {
      const { error: inviteErr } = await supabase.rpc('validate_invite_for_signup', {
        _code: inviteCode.trim(),
      });
      if (inviteErr) {
        const msg = inviteErr.message || '';
        let friendly = msg;
        if (/expired/i.test(msg)) {
          friendly = 'Ce code d’invitation a expiré. / This invite code has expired.';
        } else if (/already used/i.test(msg)) {
          friendly = 'Ce code d’invitation a déjà été utilisé. / This invite code has already been used.';
        } else if (/Invalid invite/i.test(msg)) {
          friendly = 'Code d’invitation invalide. / Invalid invite code.';
        }
        return { error: new Error(friendly) };
      }
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          invite_code: inviteCode || null,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
      }
    } catch (error) {
      console.error('Error in signOut:', error);
    } finally {
      // Always clear state regardless of API response
      setUser(null);
      setSession(null);
      setProfile(null);
      setRoles([]);
      setClientStatus(null);
      setClientName(null);
      setClientInviteCode(null);
      setClientModule(null);
      setRequiresRoleAcknowledgment(false);
    }
  };

  const acknowledgeRole = async () => {
    if (!user || !clientModule) return;

    const currentRole = isUltraAdmin
      ? 'ultra_admin'
      : isSuperAdmin
        ? 'super_admin'
        : isClientAdmin
          ? 'client_admin'
          : 'staff';

    try {
      await supabase
        .from('role_acknowledgments')
        .upsert({
          user_id: user.id,
          role: currentRole,
          module: clientModule,
        }, { onConflict: 'user_id,role,module' });

      setRequiresRoleAcknowledgment(false);
    } catch (error) {
      console.error('Error acknowledging role:', error);
    }
  };

  // Role checks - ultra_admin is DigiCam staff (platform level, no client_id)
  const isUltraAdmin = roles.includes('ultra_admin');
  // super_admin is organization head (has client_id)
  const isSuperAdmin = roles.includes('super_admin');
  // client_admin is Admin IT
  const isClientAdmin = roles.includes('client_admin');
  // staff is regular user
  const isStaff = roles.includes('staff') || (!isUltraAdmin && !isSuperAdmin && !isClientAdmin && roles.length === 0);
  // Can manage documents depends on module:
  // - Core module: Super Admin or Client Admin can manage docs
  // - Administrative module (admin_publique): ONLY Client Admin (IT Admin) can manage docs
  //   Super Admin in administrative module manages users/depts but does NOT upload
  // Ultra Admin is DigiCam staff and must not access client documents.
  const canManageDocuments = isClientAdmin || (isSuperAdmin && clientModule !== 'admin_publique');
  const isClientSuspended = clientStatus === 'suspended';
  const isUserDeactivated = profile?.status === 'deactivated';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        loading,
        signIn,
        signUp,
        signOut,
        isUltraAdmin,
        isSuperAdmin,
        isClientAdmin,
        isStaff,
        canManageDocuments,
        refreshProfile,
        clientStatus,
        clientName,
        clientInviteCode,
        isClientSuspended,
        isUserDeactivated,
        clientModule,
        moduleConfigured,
        requiresRoleAcknowledgment,
        acknowledgeRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
