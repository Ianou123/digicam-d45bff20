import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory rate limiter: { userId -> { count, windowStart } }
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 30; // requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute

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

    // User-scoped client for identity & permission checks
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    );

    // Service-role client for storage and writes
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

    // Rate limit check
    if (!checkRateLimit(user.id)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { documentId, filePath, expiresIn = 3600 } = await req.json();

    if (!documentId || !filePath) {
      return new Response(
        JSON.stringify({ error: "Missing documentId or filePath" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve caller's client_id via their profile
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

    // Verify the document belongs to the caller's organisation (server-side ownership check)
    const { data: doc } = await supabaseAdmin
      .from("documents")
      .select("id, client_id, title, document_type, is_deleted")
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

    if (doc.is_deleted) {
      return new Response(
        JSON.stringify({ error: "Document has been deleted" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalise file path (strip public URL prefix if necessary)
    let normalizedPath = filePath;
    const publicMatch = filePath.match(/\/storage\/v1\/object\/public\/documents\/(.+)/);
    if (publicMatch) {
      normalizedPath = decodeURIComponent(publicMatch[1]);
    } else if (filePath.startsWith("http")) {
      try {
        const url = new URL(filePath);
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/documents\/(.+)/);
        if (pathMatch) normalizedPath = decodeURIComponent(pathMatch[1]);
      } catch {
        // keep as-is
      }
    }

    // Generate signed URL via service role (anon key never touches storage)
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from("documents")
      .createSignedUrl(normalizedPath, expiresIn);

    if (signedError || !signedData?.signedUrl) {
      console.error("Error creating signed URL:", signedError);
      return new Response(
        JSON.stringify({ error: "Failed to generate signed URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log download action atomically server-side
    await supabaseAdmin.from("activity_logs").insert({
      user_id: user.id,
      client_id: profile.client_id,
      action_type: "download",
      document_id: documentId,
    });

    return new Response(
      JSON.stringify({ signedUrl: signedData.signedUrl }),
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
