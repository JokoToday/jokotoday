import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "../../../../context/AuthContext";
import { supabase } from "../../../../lib/supabase";
import { AuthModal } from "../../../../components/AuthModal";
import { recipeLabels } from "./labels";
import type { RecipeLanguage } from "./model";
// Shares the Favorites v2 contract; no separate recipe-like table or fake count.
export default function RecipeLike({
  id,
  language,
}: {
  id: string;
  language: RecipeLanguage;
}) {
  const { user } = useAuth();
  const t = recipeLabels[language];
  const [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [auth, setAuth] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const request = ++generation.current;
    setSaved(false);
    setError("");
    setBusy(!!user);
    if (!user) return;
    void supabase
      .from("account_saved_items")
      .select("item_id")
      .eq("user_id", user.id)
      .eq("item_type", "recipe")
      .eq("item_id", id)
      .then(({ data, error }) => {
        if (request !== generation.current) return;
        setBusy(false);
        if (error) setError(t.favoriteLater);
        else setSaved(!!data?.length);
      });
    return () => {
      generation.current = request + 1;
    };
  }, [id, user, t.favoriteLater]);
  async function toggle() {
    if (!user) {
      setAuth(true);
      return;
    }
    if (busy) return;
    const request = generation.current;
    setBusy(true);
    const { error } = await (saved
      ? supabase
          .from("account_saved_items")
          .delete()
          .eq("user_id", user.id)
          .eq("item_type", "recipe")
          .eq("item_id", id)
      : supabase
          .from("account_saved_items")
          .insert({ user_id: user.id, item_type: "recipe", item_id: id }));
    if (request !== generation.current) return;
    setBusy(false);
    if (error && error.code !== "23505") setError(t.error);
    else {
      setSaved(!saved);
      window.dispatchEvent(new Event("joko-favorites-updated"));
    }
  }
  return (
    <>
      <button
        className="recipe-action"
        type="button"
        aria-pressed={saved}
        disabled={busy || !!error}
        title={error || t.like}
        onClick={toggle}
      >
        <Heart size={18} fill={saved ? "currentColor" : "none"} />
        {t.like}
      </button>
      {error && <small role="status">{error}</small>}
      {auth && <AuthModal isOpen={true} onClose={() => setAuth(false)} />}
    </>
  );
}
