CREATE TABLE IF NOT EXISTS public.vip_magic_link_rate_limits (
  scope text NOT NULL CHECK (scope IN ('ip', 'code')),
  key_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (scope, key_hash, window_start)
);

ALTER TABLE public.vip_magic_link_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_vip_magic_link_rate_limit(
  p_ip_hash text,
  p_code_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_ip_count integer;
  v_code_count integer;
BEGIN
  IF p_ip_hash IS NULL OR p_code_hash IS NULL THEN
    RETURN false;
  END IF;

  v_window_start := date_trunc('hour', now())
    + floor(extract(minute FROM now()) / 15) * interval '15 minutes';

  INSERT INTO public.vip_magic_link_rate_limits (scope, key_hash, window_start)
  VALUES ('ip', p_ip_hash, v_window_start)
  ON CONFLICT (scope, key_hash, window_start)
  DO UPDATE SET request_count = vip_magic_link_rate_limits.request_count + 1
  RETURNING request_count INTO v_ip_count;

  INSERT INTO public.vip_magic_link_rate_limits (scope, key_hash, window_start)
  VALUES ('code', p_code_hash, v_window_start)
  ON CONFLICT (scope, key_hash, window_start)
  DO UPDATE SET request_count = vip_magic_link_rate_limits.request_count + 1
  RETURNING request_count INTO v_code_count;

  DELETE FROM public.vip_magic_link_rate_limits
  WHERE window_start < now() - interval '1 day';

  RETURN v_ip_count <= 20 AND v_code_count <= 5;
END;
$$;

REVOKE ALL ON FUNCTION public.check_vip_magic_link_rate_limit(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_vip_magic_link_rate_limit(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_vip_magic_link_rate_limit(text, text) TO service_role;
