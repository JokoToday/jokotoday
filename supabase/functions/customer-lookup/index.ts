import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

serve(async (req) => {
  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Try user_profiles
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .or(`qr_token.eq.${token},short_code.eq.${token}`)
      .maybeSingle();

    if (profile) {
      // Optional: fetch loyalty points
      const { data: customer } = await supabase
        .from("customers")
        .select("loyalty_points")
        .eq("id", profile.id)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          ...profile,
          loyalty_points: customer?.loyalty_points ?? 0,
        }),
        { status: 200 }
      );
    }

    // 2. Fallback to customers
    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .or(`qr_token.eq.${token},short_code.eq.${token}`)
      .maybeSingle();

    if (customer) {
      return new Response(JSON.stringify(customer), { status: 200 });
    }

    return new Response(JSON.stringify(null), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
});