-- Migration 041: Add scope coverage fields to bids
-- Lets bidders indicate whether they are bidding on the WHOLE project
-- or just a PART of it (with a free-text description of which part).
-- Purely additive: existing trade column and queries continue to work.

alter table public.bids
  add column if not exists scope_coverage text not null default 'all',
  add column if not exists scope_description text;

-- Restrict allowed values to keep data clean.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bids_scope_coverage_check'
  ) then
    alter table public.bids
      add constraint bids_scope_coverage_check
      check (scope_coverage in ('all', 'part'));
  end if;
end $$;

comment on column public.bids.scope_coverage is
  'Whether the bid covers the entire project (''all'') or only a portion of it (''part'').';

comment on column public.bids.scope_description is
  'When scope_coverage = ''part'', a free-text description of which part of the project the bidder is bidding on.';
