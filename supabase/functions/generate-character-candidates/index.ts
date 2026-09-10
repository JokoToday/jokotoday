import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxReferenceBytes = 20 * 1024 * 1024;
const maxReferences = 4;
const defaultImageModel = "gpt-image-2.5-sunburst";

interface CharacterGenerationRequest {
  schemaVersion: 1;
  projectId: string;
  character: Record<string, unknown>;
  style: {
    profileId: string;
    title: string;
    description: string;
    criteria: string[];
  };
  references: Array<{
    assetId: string;
    role: string;
    fidelity: string;
    preserve: string[];
    notes?: string;
    assetName: string;
    libraryRole: string;
    originalFileName: string;
    mimeType: string;
  }>;
  revisionNote?: string;
  candidateCount: number;
  output: {
    size: string;
    quality: string;
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isGenerationRequest(value: unknown): value is CharacterGenerationRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  if (request.schemaVersion !== 1 || typeof request.projectId !== "string") return false;
  if (!request.character || typeof request.character !== "object" || Array.isArray(request.character)) return false;
  if (!request.style || typeof request.style !== "object" || Array.isArray(request.style)) return false;
  if (!Array.isArray(request.references)) return false;
  if (typeof request.candidateCount !== "number" || request.candidateCount < 1 || request.candidateCount > 3) return false;
  if (!request.output || typeof request.output !== "object" || Array.isArray(request.output)) return false;
  return true;
}

function fidelityMeaning(value: string) {
  switch (value) {
    case "very_close": return "follow this reference very closely for the assigned role";
    case "recognizable": return "keep the assigned qualities clearly recognizable while allowing house-style interpretation";
    case "loose": return "use the assigned qualities as a loose structural guide";
    default: return "use this only as inspiration for the assigned role";
  }
}

function buildPrompt(request: CharacterGenerationRequest) {
  const referenceContract = request.references.length === 0
    ? "No image references are attached. Build from the CharacterSpec and Style Profile only."
    : request.references.map((reference, index) => [
      `Reference image ${index + 1}: ${reference.assetName}.`,
      `Contextual role: ${reference.role}.`,
      `Fidelity: ${fidelityMeaning(reference.fidelity)}.`,
      reference.preserve.length > 0 ? `Preserve for this role: ${reference.preserve.join(", ")}.` : "",
      reference.notes ? `Reference note: ${reference.notes}` : "",
      "Do not copy unrelated identity, clothing, pose, props, or style from this image when they fall outside its assigned role.",
    ].filter(Boolean).join(" ")).join("\n");

  const revision = request.revisionNote?.trim()
    ? `\nREVISION DIRECTION\n${request.revisionNote.trim()}`
    : "";

  return `You are producing a character-art candidate for JOKO Creative Lab.

CANONICAL CHARACTER CONTRACT
${JSON.stringify(request.character, null, 2)}

HOUSE STYLE PROFILE
${request.style.title}: ${request.style.description}
Style criteria:
${request.style.criteria.map((criterion) => `- ${criterion}`).join("\n")}

REFERENCE CONTRACT
${referenceContract}${revision}

PRODUCTION RULES
- The CharacterSpec defines who the character is.
- The Style Profile defines JOKO's visual language.
- Every input image has a specific reference role. Respect that role instead of blending all references indiscriminately.
- Preserve identity separately from temporary pose, clothing, prop, and style references.
- Produce one clean, fully resolved character illustration suitable for human review as a candidate master.
- Favor full-body presentation and a simple light/off-white background unless the CharacterSpec explicitly requires otherwise.
- Do not add captions, labels, borders, logos, UI, or explanatory text to the artwork.
- Avoid generic stock-character polish. Preserve authored irregularity and intentional asymmetry when required by the Style Profile.`;
}

async function callOpenAI(request: CharacterGenerationRequest, referenceFiles: File[]) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const model = Deno.env.get("OPENAI_IMAGE_MODEL") || defaultImageModel;
  const prompt = buildPrompt(request);
  let response: Response;

  if (referenceFiles.length > 0) {
    const body = new FormData();
    body.append("model", model);
    body.append("prompt", prompt);
    body.append("n", String(request.candidateCount));
    body.append("size", request.output.size || "1024x1536");
    body.append("quality", request.output.quality || "medium");
    referenceFiles.forEach((file) => body.append("image[]", file, file.name));

    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
    });
  } else {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        n: request.candidateCount,
        size: request.output.size || "1024x1536",
        quality: request.output.quality || "medium",
      }),
    });
  }

  const raw = await response.text();
  if (!response.ok) {
    console.error("OpenAI character generation failed", response.status, raw.slice(0, 1200));
    throw new Error(`Image provider returned ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("Image provider returned invalid JSON");
  }

  const data = (payload as { data?: Array<{ b64_json?: string }> }).data;
  if (!Array.isArray(data) || data.length === 0) throw new Error("Image provider returned no candidates");

  const candidates = data
    .map((candidate, index) => ({ index, b64Json: candidate.b64_json ?? "", mimeType: "image/png" }))
    .filter((candidate) => candidate.b64Json);
  if (candidates.length === 0) throw new Error("Image provider returned no image data");

  return { provider: "openai" as const, model, candidates };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    const bearerMatch = authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!bearerMatch) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Character generation missing Supabase server configuration");
      return jsonResponse({ error: "Server configuration unavailable" }, 503);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await supabase.auth.getUser(bearerMatch[1]);
    if (authError || !authData.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: callerProfile, error: roleError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (roleError) throw roleError;
    if (callerProfile?.role !== "admin") return jsonResponse({ error: "Forbidden" }, 403);

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return jsonResponse({ error: "Invalid multipart request" }, 400);
    }

    const requestValue = formData.get("request");
    if (typeof requestValue !== "string") return jsonResponse({ error: "Missing generation request" }, 400);

    let parsed: unknown;
    try {
      parsed = JSON.parse(requestValue);
    } catch {
      return jsonResponse({ error: "Invalid generation request" }, 400);
    }
    if (!isGenerationRequest(parsed)) return jsonResponse({ error: "Invalid generation request" }, 400);

    const referenceFiles = formData.getAll("reference").filter((value): value is File => value instanceof File);
    if (referenceFiles.length !== parsed.references.length) return jsonResponse({ error: "Reference metadata does not match uploaded images" }, 400);
    if (referenceFiles.length > maxReferences) return jsonResponse({ error: "Too many reference images" }, 400);

    for (const file of referenceFiles) {
      if (!allowedImageTypes.has(file.type)) return jsonResponse({ error: "Unsupported reference image type" }, 400);
      if (file.size > maxReferenceBytes) return jsonResponse({ error: "Reference image exceeds 20 MB" }, 400);
    }

    if (!Deno.env.get("OPENAI_API_KEY")) {
      return jsonResponse({ error: "Character Generation is not configured yet" }, 503);
    }

    const result = await callOpenAI(parsed, referenceFiles);
    return jsonResponse(result, 200);
  } catch (error) {
    console.error("Character generation failed", error);
    return jsonResponse({ error: "Character generation failed" }, 500);
  }
});
