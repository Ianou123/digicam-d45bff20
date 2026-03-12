import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const results: any[] = [];
  const defaultPassword = "TestUser2024!";

  // Get department IDs
  const { data: departments } = await supabaseAdmin.from("departments").select("id, name, client_id");
  const getDeptId = (clientId: string, name: string) => 
    departments?.find(d => d.client_id === clientId && d.name === name)?.id;

  const CABINET_ID = "dd2de8c5-c49f-41c0-a73b-7ece78469aad";
  const TRANSAFRIK_ID = "9d88117f-88a6-4375-b342-75efaa2e8c9f";
  const STUDIO_ID = "0be5f511-a470-43cf-bb24-2a8f96d2ee89";

  // Users to create with their roles and departments
  const usersToCreate = [
    // Cabinet Kouassi - Super Admin
    { email: "kouassi@cabinetka.ci", full_name: "Maître Kouassi", client_id: CABINET_ID, role: "super_admin", department_id: null },
    // Cabinet Kouassi - IT Admin
    { email: "koffi@cabinetka.ci", full_name: "Yao Koffi", client_id: CABINET_ID, role: "client_admin", department_id: null },
    // Cabinet Kouassi - Users
    { email: "traore@cabinetka.ci", full_name: "Awa Traoré", client_id: CABINET_ID, role: "staff", department_name: "Droit des Affaires" },
    { email: "cisse@cabinetka.ci", full_name: "Ibrahima Cissé", client_id: CABINET_ID, role: "staff", department_name: "Contentieux" },

    // TransAfrik - Super Admin
    { email: "diallo@transafrik.ci", full_name: "Amadou Diallo", client_id: TRANSAFRIK_ID, role: "super_admin", department_id: null },
    // TransAfrik - IT Admin
    { email: "camara@transafrik.ci", full_name: "Sékou Camara", client_id: TRANSAFRIK_ID, role: "client_admin", department_name: "Opérations" },
    // TransAfrik - Users
    { email: "kone@transafrik.ci", full_name: "Marie Koné", client_id: TRANSAFRIK_ID, role: "staff", department_name: "Comptabilité" },
    { email: "aka@transafrik.ci", full_name: "Jean-Paul Aka", client_id: TRANSAFRIK_ID, role: "staff", department_name: "Ressources Humaines" },

    // Studio Créatif - Super Admin (acts as Admin in Core)
    { email: "bamba@studiocrea.ci", full_name: "Fatou Bamba", client_id: STUDIO_ID, role: "super_admin", department_id: null },
    // Studio Créatif - Users
    { email: "yao@studiocrea.ci", full_name: "Olivier Yao", client_id: STUDIO_ID, role: "staff", department_name: "Design" },
    { email: "sanogo@studiocrea.ci", full_name: "Aïcha Sanogo", client_id: STUDIO_ID, role: "staff", department_name: "Administration" },
  ];

  for (const user of usersToCreate) {
    try {
      // Check if user already exists
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();

      if (existingProfile) {
        results.push({ email: user.email, status: "already_exists" });
        continue;
      }

      // Create auth user (auto-confirm)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: { full_name: user.full_name, invite_code: null },
      });

      if (authError) {
        results.push({ email: user.email, status: "auth_error", error: authError.message });
        continue;
      }

      const userId = authData.user.id;

      // Resolve department ID
      let departmentId = (user as any).department_id ?? null;
      if (!departmentId && (user as any).department_name) {
        departmentId = getDeptId(user.client_id, (user as any).department_name);
      }

      // Update the profile (created by trigger) with client_id and department
      await supabaseAdmin
        .from("profiles")
        .update({ 
          client_id: user.client_id, 
          full_name: user.full_name,
          department_id: departmentId 
        })
        .eq("id", userId);

      // Delete default role assigned by trigger and set correct role
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: user.role });

      // For IT Admin in admin_publique, add to all departments via user_departments
      if (user.role === "client_admin") {
        const clientDepts = departments?.filter(d => d.client_id === user.client_id) || [];
        for (const dept of clientDepts) {
          await supabaseAdmin.from("user_departments").insert({
            user_id: userId,
            department_id: dept.id,
          });
        }
      }

      // For staff in admin_publique, also add to user_departments
      if (user.role === "staff" && departmentId && 
          (user.client_id === CABINET_ID || user.client_id === TRANSAFRIK_ID)) {
        await supabaseAdmin.from("user_departments").insert({
          user_id: userId,
          department_id: departmentId,
        });
      }

      results.push({ email: user.email, status: "created", role: user.role, userId });
    } catch (err) {
      results.push({ email: user.email, status: "error", error: String(err) });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
