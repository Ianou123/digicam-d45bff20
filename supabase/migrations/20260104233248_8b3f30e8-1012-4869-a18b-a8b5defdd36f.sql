-- DigiCam Multi-tenant Document Archive Schema

-- Enums for roles and document types
CREATE TYPE public.app_role AS ENUM ('super_admin', 'client_admin', 'staff');
CREATE TYPE public.document_type AS ENUM ('pdf', 'jpg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx');
CREATE TYPE public.confidentiality_level AS ENUM ('public', 'internal', 'confidential');
CREATE TYPE public.action_type AS ENUM ('search', 'view', 'download', 'upload', 'update', 'delete');

-- Clients (Organizations/Tenants)
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Profiles
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    preferred_language TEXT DEFAULT 'fr',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Roles (separate table for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Departments within organizations
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Documents
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    document_type document_type NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    confidentiality_level confidentiality_level NOT NULL DEFAULT 'internal',
    current_version INTEGER NOT NULL DEFAULT 1,
    ocr_text TEXT,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document Versions
CREATE TABLE public.document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT,
    ocr_text TEXT,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_notes TEXT,
    UNIQUE (document_id, version_number)
);

-- Activity Logs
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    action_type action_type NOT NULL,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    search_query TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_documents_client_id ON public.documents(client_id);
CREATE INDEX idx_documents_department_id ON public.documents(department_id);
CREATE INDEX idx_documents_uploaded_by ON public.documents(uploaded_by);
CREATE INDEX idx_documents_confidentiality ON public.documents(confidentiality_level);
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX idx_documents_ocr_text ON public.documents USING gin(to_tsvector('french', coalesce(ocr_text, '')));
CREATE INDEX idx_documents_title ON public.documents USING gin(to_tsvector('french', title));
CREATE INDEX idx_documents_tags ON public.documents USING gin(tags);

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_client_id ON public.activity_logs(client_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

CREATE INDEX idx_profiles_client_id ON public.profiles(client_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_departments_client_id ON public.departments(client_id);

-- Enable RLS on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Security definer functions for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

CREATE OR REPLACE FUNCTION public.get_user_client_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT client_id
    FROM public.profiles
    WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(_user_id, 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.is_client_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(_user_id, 'client_admin')
$$;

-- RLS Policies for clients
CREATE POLICY "Super admins can see all clients"
    ON public.clients FOR SELECT
    TO authenticated
    USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can see their own client"
    ON public.clients FOR SELECT
    TO authenticated
    USING (id = public.get_user_client_id(auth.uid()));

CREATE POLICY "Super admins can manage clients"
    ON public.clients FOR ALL
    TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Super admins can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Client admins can view profiles in their org"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (
        public.is_client_admin(auth.uid())
        AND client_id = public.get_user_client_id(auth.uid())
    );

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Super admins can manage all profiles"
    ON public.profiles FOR ALL
    TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Client admins can manage profiles in their org"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_client_admin(auth.uid())
        AND client_id = public.get_user_client_id(auth.uid())
    );

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage all roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Client admins can view roles in their org"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (
        public.is_client_admin(auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = user_roles.user_id
            AND profiles.client_id = public.get_user_client_id(auth.uid())
        )
    );

-- RLS Policies for departments
CREATE POLICY "Users can view departments in their org"
    ON public.departments FOR SELECT
    TO authenticated
    USING (
        public.is_super_admin(auth.uid())
        OR client_id = public.get_user_client_id(auth.uid())
    );

CREATE POLICY "Super admins can manage all departments"
    ON public.departments FOR ALL
    TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Client admins can manage departments in their org"
    ON public.departments FOR ALL
    TO authenticated
    USING (
        public.is_client_admin(auth.uid())
        AND client_id = public.get_user_client_id(auth.uid())
    )
    WITH CHECK (
        public.is_client_admin(auth.uid())
        AND client_id = public.get_user_client_id(auth.uid())
    );

-- RLS Policies for documents
CREATE POLICY "Super admins can see all documents"
    ON public.documents FOR SELECT
    TO authenticated
    USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can see documents in their org"
    ON public.documents FOR SELECT
    TO authenticated
    USING (client_id = public.get_user_client_id(auth.uid()));

CREATE POLICY "Admins can insert documents"
    ON public.documents FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_super_admin(auth.uid())
        OR (
            public.is_client_admin(auth.uid())
            AND client_id = public.get_user_client_id(auth.uid())
        )
    );

CREATE POLICY "Admins can update documents"
    ON public.documents FOR UPDATE
    TO authenticated
    USING (
        public.is_super_admin(auth.uid())
        OR (
            public.is_client_admin(auth.uid())
            AND client_id = public.get_user_client_id(auth.uid())
        )
    )
    WITH CHECK (
        public.is_super_admin(auth.uid())
        OR (
            public.is_client_admin(auth.uid())
            AND client_id = public.get_user_client_id(auth.uid())
        )
    );

CREATE POLICY "Admins can delete documents"
    ON public.documents FOR DELETE
    TO authenticated
    USING (
        public.is_super_admin(auth.uid())
        OR (
            public.is_client_admin(auth.uid())
            AND client_id = public.get_user_client_id(auth.uid())
        )
    );

-- RLS Policies for document_versions
CREATE POLICY "Admins can view document versions"
    ON public.document_versions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = document_versions.document_id
            AND (
                public.is_super_admin(auth.uid())
                OR (
                    public.is_client_admin(auth.uid())
                    AND d.client_id = public.get_user_client_id(auth.uid())
                )
            )
        )
    );

CREATE POLICY "Admins can insert document versions"
    ON public.document_versions FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = document_versions.document_id
            AND (
                public.is_super_admin(auth.uid())
                OR (
                    public.is_client_admin(auth.uid())
                    AND d.client_id = public.get_user_client_id(auth.uid())
                )
            )
        )
    );

-- RLS Policies for activity_logs
CREATE POLICY "Users can view own activity"
    ON public.activity_logs FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all activity"
    ON public.activity_logs FOR SELECT
    TO authenticated
    USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Client admins can view org activity"
    ON public.activity_logs FOR SELECT
    TO authenticated
    USING (
        public.is_client_admin(auth.uid())
        AND client_id = public.get_user_client_id(auth.uid())
    );

CREATE POLICY "Users can insert own activity"
    ON public.activity_logs FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- Storage policies
CREATE POLICY "Authenticated users can view documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'documents');

CREATE POLICY "Admins can upload documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'documents'
        AND (
            public.is_super_admin(auth.uid())
            OR public.is_client_admin(auth.uid())
        )
    );

CREATE POLICY "Admins can update documents"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'documents'
        AND (
            public.is_super_admin(auth.uid())
            OR public.is_client_admin(auth.uid())
        )
    );

CREATE POLICY "Admins can delete documents"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'documents'
        AND (
            public.is_super_admin(auth.uid())
            OR public.is_client_admin(auth.uid())
        )
    );