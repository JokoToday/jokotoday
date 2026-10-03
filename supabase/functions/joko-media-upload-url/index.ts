import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PRODUCT_MAX_BYTES = 8 * 1024 * 1024;
const BRAND_LOGO_MAX_BYTES = 1024 * 1024;
const GALLERY_MAX_BYTES = 8 * 1024 * 1024;
const CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/png": "png",
};

type AssetKind = "product" | "brand" | "gallery";

function jsonResponse(body: unknown, status: number): Response {
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

function resolveObjectKey(
  body: Record<string, unknown>,
  extension: string,
  timestamp: string,
  nonce: string,
): { objectKey: string; maxBytes: number; errorLabel: string } | null {
  const assetKind: AssetKind = body.assetKind === "brand"
    ? "brand"
    : body.assetKind === "gallery"
      ? "gallery"
      : "product";

  if (assetKind === "brand") {
    const brandSlot = typeof body.brandSlot === "string" ? body.brandSlot.trim().toLowerCase() : "";
    if (brandSlot !== "site-logo") return null;
    return {
      objectKey: `brand/site-logo/${timestamp}-${nonce}-logo.${extension}`,
      maxBytes: BRAND_LOGO_MAX_BYTES,
      errorLabel: "Logo files must be 1 MB or smaller",
    };
  }

  if (assetKind === "gallery") {
    const gallerySlot = typeof body.gallerySlot === "string"
      ? body.gallerySlot.trim().toLowerCase()
      : "around-joko";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gallerySlot)) return null;
    return {
      objectKey: `gallery/${gallerySlot}/${timestamp}-${nonce}.${extension}`,
      maxBytes: GALLERY_MAX_BYTES,
      errorLabel: "Gallery images must be 8 MB or smaller",
    };
  }

  const productSlug = typeof body.productSlug === "string"
    ? body.productSlug.trim().toLowerCase()
    : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug)) return null;

  return {
    objectKey: `products/${productSlug}/${timestamp}-${nonce}-main.${extension}`,
    maxBytes: PRODUCT_MAX_BYTES,
    errorLabel: "Product images must be 8 MB or smaller",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
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

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || Array.isArray(body)) return jsonResponse({ error: "Invalid request body" }, 400);

    const assetKind: AssetKind = body.assetKind === "brand"
      ? "brand"
      : body.assetKind === "gallery"
        ? "gallery"
        : "product";
    const canUpload = profile?.role === "admin"
      || (profile?.role === "product_staff" && assetKind === "product");
    if (!canUpload) return jsonResponse({ error: "Forbidden" }, 403);

    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const contentType = typeof body.contentType === "string"
      ? body.contentType.trim().toLowerCase()
      : "";
    const sizeBytes = typeof body.sizeBytes === "number" ? body.sizeBytes : Number(body.sizeBytes);

    if (!fileName) return jsonResponse({ error: "File name is required" }, 400);
    if (!CONTENT_TYPES[contentType]) {
      return jsonResponse({ error: "Use a JPG, WebP or PNG image" }, 400);
    }

    const extension = CONTENT_TYPES[contentType];
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    const target = resolveObjectKey(body, extension, timestamp, nonce);

    if (!target) {
      return jsonResponse({ error: "Invalid media destination" }, 400);
    }

    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > target.maxBytes) {
      return jsonResponse({ error: target.errorLabel }, 400);
    }

    const accountId = requiredEnv("R2_ACCOUNT_ID");
    const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
    const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
    const bucket = requiredEnv("R2_BUCKET_NAME");
    const publicBaseUrl = requiredEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");

    if (!/^https:\/\//i.test(publicBaseUrl)) {
      throw new Error("R2_PUBLIC_BASE_URL must use HTTPS");
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: target.objectKey,
      ContentType: contentType,
      // ContentLength is part of the signed PUT contract. The browser supplies
      // the actual Content-Length from the File body; a larger/smaller upload
      // cannot reuse a ticket issued for a different declared size.
      ContentLength: sizeBytes,
    });

    const expiresIn = 300;
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn });
    const publicUrl = `${publicBaseUrl}/${target.objectKey}`;

    return jsonResponse({
      uploadUrl,
      publicUrl,
      objectKey: target.objectKey,
      expiresIn,
    }, 200);
  } catch (error) {
    console.error("JOKO Media upload ticket failed", error);
    return jsonResponse({ error: "Could not prepare the media upload" }, 500);
  }
});
