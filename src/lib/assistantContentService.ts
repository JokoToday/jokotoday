import { supabase } from "./supabase";
import {
  parseAssistantContent,
  type AssistantContent,
} from "../app/joko-today/assistant/content";

export type AssistantAdminState = {
  version: number;
  draft: AssistantContent;
  publishedAt: string | null;
};
export async function loadAssistantContent(): Promise<AssistantContent | null> {
  const { data, error } = await supabase.rpc("get_published_ask_joko_v1");
  if (error) throw Error("Ask JOKO saved answers are unavailable.");
  return data ? parseAssistantContent(data) : null;
}
function parseState(data: unknown): AssistantAdminState {
  const v = data as AssistantAdminState;
  if (!v || !Number.isSafeInteger(v.version))
    throw Error("Invalid Ask JOKO Admin response.");
  return {
    version: v.version,
    draft: parseAssistantContent(v.draft),
    publishedAt: v.publishedAt ?? null,
  };
}
export async function loadAssistantAdmin(): Promise<AssistantAdminState> {
  const { data, error } = await supabase.rpc("get_admin_ask_joko_v1");
  if (error) throw Error(error.message);
  return parseState(data);
}
export async function saveAssistantDraft(
  document: AssistantContent,
  version: number,
): Promise<AssistantAdminState> {
  const { data, error } = await supabase.rpc("save_ask_joko_draft_v1", {
    p_document: parseAssistantContent(document),
    p_expected_version: version,
  });
  if (error) throw Error(error.message);
  return parseState(data);
}
export async function publishAssistantContent(
  version: number,
): Promise<AssistantAdminState> {
  const { data, error } = await supabase.rpc("publish_ask_joko_v1", {
    p_expected_version: version,
  });
  if (error) throw Error(error.message);
  return parseState(data);
}
