-- Match the post-Phase-A production grant state exactly.
-- Supabase retained an EXECUTE grant for anon on the new helper after the
-- primary migration, so explicitly remove it.
REVOKE EXECUTE ON FUNCTION public.is_staff_or_admin() FROM anon;
