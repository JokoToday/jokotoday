import { supabase } from "../../../../lib/supabase";
import {
  parseRecipe,
  publishProblems,
  type RecipeRecord,
  type StoredRecipe,
} from "./model";
export async function listRecipes(drafts = false): Promise<StoredRecipe[]> {
  let query = supabase
    .from(drafts ? "diy_recipe_drafts" : "diy_recipes")
    .select("id,slug,payload,revision,updated_at")
    .order("updated_at", { ascending: false });
  if (!drafts) query = query.eq("is_published", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, payload: parseRecipe(r.payload) }));
}
export async function getRecipe(slug: string): Promise<StoredRecipe | null> {
  const { data, error } = await supabase
    .from("diy_recipes")
    .select("id,slug,payload,revision,updated_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, payload: parseRecipe(data.payload) } : null;
}
export async function saveRecipe(
  payload: RecipeRecord,
  existing?: StoredRecipe,
): Promise<StoredRecipe> {
  parseRecipe(payload);
  const q = existing
    ? supabase
        .from("diy_recipe_drafts")
        .update({ payload, slug: payload.slug })
        .eq("id", existing.id)
        .eq("revision", existing.revision)
    : supabase
        .from("diy_recipe_drafts")
        .insert({ payload, slug: payload.slug });
  const { data, error } = await q
    .select("id,slug,payload,revision,updated_at")
    .single();
  if (error)
    throw new Error(
      `Could not save. Another editor may have changed this recipe; reload before retrying. ${error.message}`,
    );
  return { ...data, payload: parseRecipe(data.payload) };
}
export async function publishRecipe(recipe: StoredRecipe) {
  const problems = publishProblems(recipe.payload);
  if (problems.length) throw new Error(problems.join("\n"));
  const { error } = await supabase.rpc("diy_publish_recipe", {
    recipe_id: recipe.id,
    expected_revision: recipe.revision,
  });
  if (error) throw error;
}
export async function unpublishRecipe(id: string) {
  const { data, error } = await supabase
    .from("diy_recipes")
    .update({ is_published: false })
    .eq("id", id)
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Unpublish failed");
}
export interface RecipeComment {
  id: string;
  recipe_id: string;
  author_name: string;
  body: string;
  photos: string[];
  created_at: string;
  status?: string;
  revision?: number;
}
export async function loadComments(
  recipeId?: string,
  own = false,
  userId?: string,
): Promise<RecipeComment[]> {
  let q = supabase
    .from(own ? "diy_comment_submissions" : "diy_recipe_comments")
    .select(
      own
        ? "id,recipe_id,author_name,body,photos,created_at,status,revision"
        : "id,recipe_id,author_name,body,photos,created_at",
    )
    .order("created_at", { ascending: false });
  if (recipeId) q = q.eq("recipe_id", recipeId);
  if (userId && own) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as RecipeComment[];
}
export async function moderateComment(c: RecipeComment, approve: boolean) {
  const { error } = await supabase.rpc("diy_moderate_comment", {
    p_id: c.id,
    p_approve: approve,
    p_revision: c.revision,
  });
  if (error) throw error;
}
export async function reviseComment(c: RecipeComment, body: string) {
  const { error } = await supabase.rpc("diy_revise_comment", {
    p_id: c.id,
    p_body: body,
    p_revision: c.revision,
  });
  if (error) throw error;
}
export async function withdrawComment(id: string) {
  const { error } = await supabase.rpc("diy_withdraw_comment", { p_id: id });
  if (error) throw error;
}
export async function submitComment(
  recipeId: string,
  body: string,
  photos: Blob[],
  userId: string,
) {
  const { data: id, error } = await supabase.rpc("diy_start_comment", {
    p_recipe: recipeId,
    p_body: body,
  });
  if (error) throw error;
  const paths: string[] = [];
  try {
    for (let i = 0; i < photos.length; i++) {
      const path = `${userId}/${id}/${i}.webp`;
      const { error } = await supabase.storage
        .from("diy-comment-photos")
        .upload(path, photos[i], {
          contentType: "image/webp",
          upsert: false,
          cacheControl: "0",
        });
      if (error) throw error;
      paths.push(path);
    }
    const { error } = await supabase.rpc("diy_finish_comment", {
      p_id: id,
      p_photos: paths,
    });
    if (error) throw error;
  } catch (e) {
    await withdrawComment(id).catch(() => {});
    throw e;
  }
}
