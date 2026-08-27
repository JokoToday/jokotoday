/*
  JOKO TODAY — Loyalty v2 earning-rate normalization

  `points_per_baht` is the canonical earning rate. Keep the legacy `multiplier`
  compatibility column synchronized at cutover so old/read-only UI surfaces do
  not display a stale value (notably the historical walk-in 0.50 vs canonical
  0.05 mismatch).
*/

UPDATE public.loyalty_settings
SET
  multiplier = points_per_baht,
  updated_at = now()
WHERE points_per_baht IS NOT NULL
  AND multiplier IS DISTINCT FROM points_per_baht;
