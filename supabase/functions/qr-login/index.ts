import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { qr_token } = await req.json();

    if (!qr_token) {
      return new Response(
        JSON.stringify({ message: "QR token is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);

    const { data: profile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('id, email')
      .eq('qr_token', qr_token)
      .maybeSingle();

    if (profileError || !profile || !profile.email) {
      return new Response(
        JSON.stringify({
          message: "Hmm, we couldn't recognize that QR code. Please try again or log in with email."
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      throw linkError ?? new Error("Failed to generate magic link");
    }

    const { data: verified, error: verifyError } = await anonClient.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: 'email',
    });

    if (verifyError) {
      throw verifyError;
    }

    const access_token = verified?.session?.access_token;
    const refresh_token = verified?.session?.refresh_token;

    if (!access_token || !refresh_token) {
      return new Response(
        JSON.stringify({ message: "Failed to create session" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        access_token,
        refresh_token,
        user: { id: profile.id, email: profile.email }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('QR login error:', error);
    return new Response(
      JSON.stringify({
        message: error instanceof Error ? error.message : "An unexpected error occurred"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
