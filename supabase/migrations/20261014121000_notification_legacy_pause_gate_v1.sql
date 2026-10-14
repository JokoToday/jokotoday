BEGIN;

-- Legacy order-notification Edge Functions call this before contacting a
-- provider. Keep the pause and customer preference check in the database so
-- no client-side flag can bypass it. A NULL customer is reserved for internal
-- notifications and checks only the global/channel pause controls.
CREATE FUNCTION private.notification_channel_allowed_v1(
  p_customer_id uuid,
  p_channel text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT NOT c.paused
      AND CASE p_channel
        WHEN 'email' THEN NOT c.email_paused
        WHEN 'line' THEN NOT c.line_paused
        ELSE false
      END
    FROM private.notification_control_v1 c
    WHERE c.id = true
  ), false)
  AND (
    p_customer_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles p
      WHERE p.id = p_customer_id
        AND CASE p_channel
          WHEN 'email' THEN p.notification_email_enabled IS DISTINCT FROM false
          WHEN 'line' THEN p.notification_line_enabled IS TRUE
          ELSE false
        END
    )
  );
$$;

REVOKE ALL ON FUNCTION private.notification_channel_allowed_v1(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.notification_channel_allowed_v1(uuid, text)
  TO service_role;

CREATE FUNCTION public.notification_channel_allowed_v1(
  p_customer_id uuid,
  p_channel text
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.notification_channel_allowed_v1(p_customer_id, p_channel);
$$;

REVOKE ALL ON FUNCTION public.notification_channel_allowed_v1(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notification_channel_allowed_v1(uuid, text)
  TO service_role;

COMMIT;
