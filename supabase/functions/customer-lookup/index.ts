import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Try user_profiles
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("*")
      .or(`qr_token.eq.${token},short_code.eq.${token}`)
      .maybeSingle();
    if (profileError) throw profileError;

    if (profile) {
      // Optional: fetch loyalty points
      const { data: customer, error: loyaltyError } = await supabase
        .from("customers")
        .select("loyalty_points")
        .eq("id", profile.id)
        .maybeSingle();
      if (loyaltyError) throw loyaltyError;

      return new Response(
        JSON.stringify({
          ...profile,
          loyalty_points: customer?.loyalty_points ?? 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fallback to customers
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .or(`qr_token.eq.${token},short_code.eq.${token}`)
      .maybeSingle();
    if (customerError) throw customerError;

    if (customer) {
      return new Response(JSON.stringify(customer), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(null), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown customer lookup error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
