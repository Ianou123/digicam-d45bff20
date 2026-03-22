import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiter
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

type Action = "validate" | "reject" | "resubmit" | "propose_modification" | "archive";

const ACTION_STATUS_MAP: Record<Action, string> = {
  validate: "ready",
  reject: "rejected",
  resubmit: "pending_validation",
  propose_modification: "pending_validation",
  archive: "archived",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // User-scoped client for permission checks
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    );

    // Service-role client for writes
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify caller identity
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { documentId, action, reason, comment } = await req.json();

    if (!documentId || !action) {
      return new Response(
        JSON.stringify({ error: "Missing documentId or action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!Object.keys(ACTION_STATUS_MAP).includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action. Must be one of: ${Object.keys(ACTION_STATUS_MAP).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check permission: must be client_admin or super_admin
    const [{ data: isClientAdmin }, { data: isSuperAdmin }] = await Promise.all([
      supabaseUser.rpc("is_client_admin"),
      supabaseUser.rpc("is_super_admin"),
    ]);

    if (!isClientAdmin && !isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: "Only admins can perform document workflow actions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve caller's profile
    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("client_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.client_id) {
      return new Response(
        JSON.stringify({ error: "Could not resolve caller organisation" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch document to get current status and verify ownership
    const { data: doc } = await supabaseAdmin
      .from("documents")
      .select("id, client_id, status")
      .eq("id", documentId)
      .maybeSingle();

    if (!doc) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (doc.client_id !== profile.client_id) {
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newStatus = ACTION_STATUS_MAP[action as Action];
    const previousStatus = doc.status;

    // Build activity log metadata
    const metadata: Record<string, string | null> = {
      action,
      previous_status: previousStatus,
      new_status: newStatus,
    };
    if (reason) metadata.rejection_reason = reason;
    if (comment) metadata.comment = comment;

    // Update document status
    const { error: updateError } = await supabaseAdmin
      .from("documents")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", documentId);

    if (updateError) {
      console.error("Error updating document status:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update document status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Write activity log atomically server-side
    await supabaseAdmin.from("activity_logs").insert({
      user_id: user.id,
      client_id: profile.client_id,
      action_type: "update",
      document_id: documentId,
      metadata,
    });

    return new Response(
      JSON.stringify({ success: true, newStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
