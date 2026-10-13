-- Ask JOKO editorial content. Private drafts; explicit, version-checked publication.
CREATE TABLE private.ask_joko_content (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  draft jsonb NOT NULL,
  published jsonb,
  version bigint NOT NULL DEFAULT 0,
  published_at timestamptz
);
ALTER TABLE private.ask_joko_content ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ask_joko_content FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.ask_joko_content TO service_role;
INSERT INTO private.ask_joko_content (draft) VALUES
('{"schemaVersion":1,"illustration":{"url":"","alt":{"en":"","th":"","zh":""}},"categories":[],"questions":[]}');

CREATE FUNCTION private.validate_ask_joko_document(p_document jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE c jsonb; q jsonb; l text; ids text[] := '{}'; qids text[] := '{}'; link jsonb;
BEGIN
  IF p_document IS NULL OR octet_length(p_document::text) > 1200000
    OR jsonb_typeof(p_document->'schemaVersion') IS DISTINCT FROM 'number'
    OR p_document->>'schemaVersion' IS DISTINCT FROM '1'
    OR jsonb_typeof(p_document->'categories') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_document->'questions') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_document->'illustration') IS DISTINCT FROM 'object'
    OR jsonb_array_length(p_document->'categories') > 20
    OR jsonb_array_length(p_document->'questions') > 200 THEN
    RAISE EXCEPTION 'Invalid Ask JOKO document' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_document->'illustration'->'url') IS DISTINCT FROM 'string'
    OR length(p_document->'illustration'->>'url') > 1000 THEN RAISE EXCEPTION 'Invalid illustration'; END IF;
  IF p_document->'illustration'->>'url' <> '' AND (
    p_document->'illustration'->>'url' !~* '^(/assets/[a-zA-Z0-9_./-]+\.(png|webp|jpg|jpeg)|https://(joko\.today|[a-zA-Z0-9.-]+\.joko\.today|[a-z0-9]+\.supabase\.co|pub-[a-z0-9]+\.r2\.dev)/[^?#[:space:]]+\.(png|webp|jpg|jpeg))$'
    OR p_document->'illustration'->>'url' LIKE '%..%') THEN RAISE EXCEPTION 'Invalid illustration URL'; END IF;
  FOREACH l IN ARRAY ARRAY['en','th','zh'] LOOP
    IF jsonb_typeof(p_document->'illustration'->'alt'->l) IS DISTINCT FROM 'string'
      OR length(p_document->'illustration'->'alt'->>l) > 200 THEN RAISE EXCEPTION 'Invalid illustration caption'; END IF;
  END LOOP;
  FOR c IN SELECT value FROM jsonb_array_elements(p_document->'categories') LOOP
    IF COALESCE(c->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' OR c->>'id' = ANY(ids)
      OR COALESCE(c->>'section','') NOT IN ('faq','curious','guide','live')
      OR jsonb_typeof(c->'enabled') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(c->'order') IS DISTINCT FROM 'number'
      OR COALESCE(c->>'order','') !~ '^-?[0-9]{1,6}$' THEN RAISE EXCEPTION 'Invalid category'; END IF;
    ids := array_append(ids,c->>'id');
    FOREACH l IN ARRAY ARRAY['en','th','zh'] LOOP
      IF jsonb_typeof(c->'name'->l) IS DISTINCT FROM 'string' OR length(c->'name'->>l) > 100 THEN RAISE EXCEPTION 'Invalid category translation'; END IF;
    END LOOP;
  END LOOP;
  FOR q IN SELECT value FROM jsonb_array_elements(p_document->'questions') LOOP
    IF COALESCE(q->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' OR q->>'id' = ANY(qids)
      OR NOT COALESCE(q->>'categoryId' = ANY(ids),false)
      OR jsonb_typeof(q->'enabled') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(q->'ingredientsConfirmed') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(q->'order') IS DISTINCT FROM 'number'
      OR COALESCE(q->>'order','') !~ '^-?[0-9]{1,6}$'
      OR jsonb_typeof(q->'links') IS DISTINCT FROM 'array'
      OR jsonb_array_length(q->'links') > 6 THEN RAISE EXCEPTION 'Invalid question'; END IF;
    qids := array_append(qids,q->>'id');
    FOREACH l IN ARRAY ARRAY['en','th','zh'] LOOP
      IF jsonb_typeof(q->'question'->l) IS DISTINCT FROM 'string' OR length(q->'question'->>l) > 300
        OR jsonb_typeof(q->'answer'->l) IS DISTINCT FROM 'string' OR length(q->'answer'->>l) > 4000
        OR jsonb_typeof(q->'aliases'->l) IS DISTINCT FROM 'array'
        OR jsonb_array_length(q->'aliases'->l) > 10
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(q->'aliases'->l) a WHERE jsonb_typeof(a) <> 'string' OR length(a #>> '{}') > 300) THEN RAISE EXCEPTION 'Invalid question translation'; END IF;
    END LOOP;
    FOR link IN SELECT value FROM jsonb_array_elements(q->'links') LOOP
      IF COALESCE(link->>'path','') !~ '^/(products(/[a-zA-Z0-9_-]+)?|makers(/[a-zA-Z0-9_-]+)?|how-it-works|our-story|terms|privacy)$' THEN RAISE EXCEPTION 'Invalid related page'; END IF;
      FOREACH l IN ARRAY ARRAY['en','th','zh'] LOOP
        IF jsonb_typeof(link->'label'->l) IS DISTINCT FROM 'string' OR length(link->'label'->>l) > 100 THEN RAISE EXCEPTION 'Invalid related page label'; END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION private.validate_ask_joko_document(jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_admin_ask_joko_v1()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.current_user_is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT jsonb_build_object('version',version,'draft',draft,'publishedAt',published_at) FROM private.ask_joko_content WHERE singleton);
END;
$$;

CREATE FUNCTION public.save_ask_joko_draft_v1(p_document jsonb, p_expected_version bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v bigint;
BEGIN
  IF NOT private.current_user_is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  PERFORM private.validate_ask_joko_document(p_document);
  SELECT version INTO v FROM private.ask_joko_content WHERE singleton FOR UPDATE;
  IF v IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Ask JOKO changed elsewhere. Reload before saving.' USING ERRCODE = '40001'; END IF;
  UPDATE private.ask_joko_content SET draft = p_document, version = version + 1 WHERE singleton;
  RETURN public.get_admin_ask_joko_v1();
END;
$$;

CREATE FUNCTION public.publish_ask_joko_v1(p_expected_version bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v bigint; d jsonb; categories jsonb; questions jsonb;
BEGIN
  IF NOT private.current_user_is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  SELECT version,draft INTO v,d FROM private.ask_joko_content WHERE singleton FOR UPDATE;
  IF v IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'Ask JOKO changed elsewhere. Reload before publishing.' USING ERRCODE = '40001'; END IF;
  PERFORM private.validate_ask_joko_document(d);
  SELECT COALESCE(jsonb_agg(c),'[]') INTO categories FROM jsonb_array_elements(d->'categories') c WHERE c->>'enabled' = 'true';
  SELECT COALESCE(jsonb_agg(q),'[]') INTO questions FROM jsonb_array_elements(d->'questions') q
    WHERE q->>'enabled' = 'true' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(categories) c WHERE c->>'id' = q->>'categoryId'
      AND (c->>'section' <> 'guide' OR q->>'ingredientsConfirmed' = 'true')
      AND EXISTS (SELECT 1 FROM unnest(ARRAY['en','th','zh']) l
        WHERE btrim(c->'name'->>l) <> '' AND btrim(q->'question'->>l) <> ''
        AND (c->>'section' = 'live' OR btrim(q->'answer'->>l) <> '')));
  UPDATE private.ask_joko_content SET published = jsonb_build_object('schemaVersion',1,'illustration',d->'illustration','categories',categories,'questions',questions), version = version + 1, published_at = now() WHERE singleton;
  RETURN public.get_admin_ask_joko_v1();
END;
$$;

CREATE FUNCTION public.get_published_ask_joko_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT published FROM private.ask_joko_content WHERE singleton;
$$;
REVOKE ALL ON FUNCTION public.get_admin_ask_joko_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_ask_joko_draft_v1(jsonb,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_ask_joko_v1(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_published_ask_joko_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_ask_joko_v1(), public.save_ask_joko_draft_v1(jsonb,bigint), public.publish_ask_joko_v1(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_published_ask_joko_v1() TO anon, authenticated;
COMMENT ON FUNCTION public.get_published_ask_joko_v1() IS 'Public read-only projection of explicitly published editorial content. Never returns draft data.';
