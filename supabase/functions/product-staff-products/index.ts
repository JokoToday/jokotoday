import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
};

const ALLOWED_FIELDS = [
  "name_en", "name_th", "name_zh",
  "desc_en", "desc_th", "desc_zh",
  "price", "category_id", "image",
  "short_desc_en", "short_desc_th", "short_desc_zh",
  "joko_note_en", "joko_note_th", "joko_note_zh",
  "ingredients_en", "ingredients_th", "ingredients_zh",
  "allergens_en", "allergens_th", "allergens_zh",
  "storage_en", "storage_th", "storage_zh",
  "best_enjoyed_en", "best_enjoyed_th", "best_enjoyed_zh",
  "reheating_en", "reheating_th", "reheating_zh",
  "is_sold_out", "is_active", "available_days",
] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validatePatch(patch: Record<string, unknown>): string | null {
  const unknownFields = Object.keys(patch).filter(
    (key) => !ALLOWED_FIELDS.includes(key as AllowedField),
  );
  if (unknownFields.length > 0) {
    return `Product Staff cannot change fields: ${unknownFields.join(", ")}`;
  }

  for (const field of ["name_en", "name_th"] as const) {
    if (field in patch && (typeof patch[field] !== "string" || !patch[field]!.trim())) {
      return `${field} is required`;
    }
  }

  if ("price" in patch) {
    const price = Number(patch.price);
    if (!Number.isFinite(price) || price < 0) return "Price must be zero or greater";
  }

  for (const field of ["is_sold_out", "is_active"] as const) {
    if (field in patch && typeof patch[field] !== "boolean") {
      return `${field} must be boolean`;
    }
  }

  if ("available_days" in patch) {
    if (
      !Array.isArray(patch.available_days)
      || !patch.available_days.every((day) => typeof day === "string")
    ) {
      return "available_days must be an array of strings";
    }
  }

  if ("image" in patch && patch.image !== null) {
    if (typeof patch.image !== "string") return "image must be an HTTPS URL or null";
    try {
      const url = new URL(patch.image);
      if (url.protocol !== "https:") return "image must use HTTPS";
    } catch {
      return "image must be a valid HTTPS URL";
    }
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "PATCH") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authorization = req.headers.get("Authorization");
    const bearerMatch = authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!bearerMatch) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: authData, error: authError } = await supabase.auth.getUser(bearerMatch[1]);
    if (authError || !authData.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    const actorRole = typeof profile?.role === "string" ? profile.role : "";
    if (actorRole !== "admin" && actorRole !== "product_staff") {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    if (req.method === "GET") {
      const { data: products, error } = await supabase
        .from("cms_products")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name_en", { ascending: true });
      if (error) throw error;
      return jsonResponse({ products: products || [] });
    }

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!isRecord(body)) return jsonResponse({ error: "Invalid request body" }, 400);

    const productId = typeof body.productId === "string" ? body.productId.trim() : "";
    const patch = isRecord(body.patch) ? body.patch : null;
    if (!productId) return jsonResponse({ error: "Product is required" }, 400);
    if (!patch) return jsonResponse({ error: "Product patch must be an object" }, 400);

    const patchError = validatePatch(patch);
    if (patchError) return jsonResponse({ error: patchError }, 400);

    if ("category_id" in patch) {
      if (typeof patch.category_id !== "string" || !patch.category_id) {
        return jsonResponse({ error: "An active category is required" }, 400);
      }
      const { data: category, error: categoryError } = await supabase
        .from("cms_categories")
        .select("id")
        .eq("id", patch.category_id)
        .eq("is_active", true)
        .maybeSingle();
      if (categoryError) throw categoryError;
      if (!category) return jsonResponse({ error: "An active category is required" }, 400);
    }

    const { data: product, error: updateError } = await supabase.rpc(
      "product_staff_apply_product_update_v1",
      {
        p_product_id: productId,
        p_actor_user_id: authData.user.id,
        p_actor_role: actorRole,
        p_patch: patch,
      },
    );
    if (updateError) {
      if (updateError.code === "P0002") return jsonResponse({ error: "Product not found" }, 404);
      if (updateError.code === "42501") return jsonResponse({ error: updateError.message }, 403);
      throw updateError;
    }

    return jsonResponse({ product });
  } catch (error) {
    console.error("Product Staff API error:", error);
    return jsonResponse({ error: "Product Staff request failed" }, 500);
  }
});
