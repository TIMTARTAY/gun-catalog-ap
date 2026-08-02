-- Run this entire script in Supabase: SQL Editor > New query > Run
create table if not exists public.catalogs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.catalogs enable row level security;

revoke all on table public.catalogs from anon;
grant select, insert, update, delete on table public.catalogs to authenticated;

drop policy if exists "Users read own catalog" on public.catalogs;
create policy "Users read own catalog"
on public.catalogs for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own catalog" on public.catalogs;
create policy "Users insert own catalog"
on public.catalogs for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users update own catalog" on public.catalogs;
create policy "Users update own catalog"
on public.catalogs for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users delete own catalog" on public.catalogs;
create policy "Users delete own catalog"
on public.catalogs for delete
to authenticated
using (auth.uid() = user_id);

-- Needed for automatic live updates on other signed-in devices.
do $$
begin
  alter publication supabase_realtime add table public.catalogs;
exception
  when duplicate_object then null;
end $$;
