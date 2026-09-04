-- Cover Homepage Builder foreign-key columns that are not already left-most
-- columns of a unique or query index. This keeps the persistence schema clear
-- of avoidable unindexed-FK advisor findings.

create index platform_builder_pages_draft_updated_by_idx
  on public.platform_builder_pages(draft_updated_by);

create index platform_builder_pages_draft_source_revision_idx
  on public.platform_builder_pages(draft_source_revision_id);

create index platform_builder_pages_published_revision_idx
  on public.platform_builder_pages(published_revision_id);

create index platform_builder_pages_published_by_idx
  on public.platform_builder_pages(published_by);

create index platform_builder_pages_created_by_idx
  on public.platform_builder_pages(created_by);

create index platform_builder_revisions_published_by_idx
  on public.platform_builder_page_revisions(published_by);

create index platform_builder_revisions_restored_from_idx
  on public.platform_builder_page_revisions(restored_from_revision_id);

-- Internal helpers must not inherit PostgreSQL's default EXECUTE privilege for
-- PUBLIC. They remain usable by their owning private functions / trigger only.
revoke all on function private.reject_builder_revision_mutation() from public, anon, authenticated;
revoke all on function private.assert_builder_document_v1(jsonb, text) from public, anon, authenticated;
revoke all on function private.builder_page_state_v1(uuid) from public, anon, authenticated;
