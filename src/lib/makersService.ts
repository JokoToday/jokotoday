import { supabase } from "./supabase";
import type { CMSProduct } from "./cmsService";

export type ProductOrigin = "joko" | "beyond" | "maker";
export interface Maker {
  id: string;
  slug: string;
  name_en: string;
  name_th: string;
  name_zh: string | null;
  intro_en: string;
  intro_th: string;
  intro_zh: string | null;
  story_en: string;
  story_th: string;
  story_zh: string | null;
  joko_note_en: string;
  joko_note_th: string;
  joko_note_zh: string | null;
  location: string;
  hero_image: string | null;
  website_url: string | null;
  is_published: boolean;
  show_on_homepage: boolean;
  is_ordering_enabled: boolean;
  sort_order: number;
}
export type MakerDraft = Omit<Maker, "id">;
export type MakerIdentity = Pick<
  Maker,
  "id" | "slug" | "name_en" | "name_th" | "name_zh" | "is_ordering_enabled"
>;
export function productOrigin(
  product: Pick<CMSProduct, "product_origin" | "is_non_bakery">,
): ProductOrigin {
  return product.product_origin || (product.is_non_bakery ? "beyond" : "joko");
}
export function makerText(
  maker: Maker,
  field: "name" | "intro" | "story" | "joko_note",
  language: "en" | "th" | "zh",
): string {
  return maker[`${field}_${language}`] || maker[`${field}_en`] || "";
}
export async function getMakers(admin = false): Promise<Maker[]> {
  let query = supabase
    .from("cms_makers")
    .select("*")
    .order("sort_order")
    .order("name_en");
  if (!admin) query = query.eq("is_published", true);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
export async function saveMaker(
  draft: MakerDraft,
  id?: string,
): Promise<Maker> {
  const query = id
    ? supabase.from("cms_makers").update(draft).eq("id", id)
    : supabase.from("cms_makers").insert(draft);
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return data as Maker;
}
