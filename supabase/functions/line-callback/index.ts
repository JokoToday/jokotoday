import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LineTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

interface LineProfileResponse {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Missing authorization code" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const lineChannelId = Deno.env.get("LINE_CHANNEL_ID");
    const lineChannelSecret = Deno.env.get("LINE_CHANNEL_SECRET");
    const lineRedirectUri = Deno.env.get("LINE_REDIRECT_URI");

    if (!lineChannelId || !lineChannelSecret || !lineRedirectUri) {
      return new Response(
        JSON.stringify({ error: "LINE credentials not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tokenUrl = "https://api.line.me/oauth2/v2.1/token";
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: lineRedirectUri,
      client_id: lineChannelId,
      client_secret: lineChannelSecret,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("LINE token error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to exchange token with LINE" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const tokenData: LineTokenResponse = await tokenResponse.json();

    const profileUrl = "https://api.line.me/v2/profile";
    const profileResponse = await fetch(profileUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch LINE profile" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const profileData: LineProfileResponse = await profileResponse.json();

    const appOrigin = req.headers.get("origin") || "https://joko-today-pre-order-yamv.bolt.host";

    const params = new URLSearchParams({
      line_user_id: profileData.userId,
      display_name: profileData.displayName || "",
      picture_url: profileData.pictureUrl || "",
      state: state || "",
      code,
    });

    const redirectUrl = `${appOrigin}?${params.toString()}`;

    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl,
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error("LINE callback error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
