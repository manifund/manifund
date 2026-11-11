-- Who may give from a fund (a profile with type 'fund'). Rows are added by hand with the service role;
-- the routes that give as a fund (place-bid, transfer-money) check membership here.

create table public.fund_admins (
  fund_id uuid not null references public.profiles (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (fund_id, profile_id)
);

alter table public.fund_admins enable row level security;

create policy "Enable read access for all users" on public.fund_admins
  for select using (true);
