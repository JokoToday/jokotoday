/*
  JOKO TODAY — Loyalty v2 post-cutover Admin adjustment gate

  The foundation migration intentionally keeps Admin balance adjustment dark so
  no post-v2 point event can be inserted before the atomic opening-balance
  cutover in 20260825172500_loyalty_v2_earning_lifecycle.sql.

  Re-enable the authenticated entry point only after that cutover has committed.
  The function itself remains SECURITY DEFINER and performs its DB-derived Admin
  authorization internally.
*/

REVOKE ALL ON FUNCTION public.admin_adjust_loyalty_points_v2(uuid, integer, text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_adjust_loyalty_points_v2(uuid, integer, text)
TO authenticated;
