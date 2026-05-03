
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  active_deliverables text,
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

create table public.morning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  energy_level int,
  focus_brands text[] default '{}',
  notes text,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo',
  priority int not null default 3,
  energy_required text not null default 'medium',
  deadline date,
  estimated_minutes int,
  created_from text not null default 'manual',
  session_id uuid references public.morning_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.brands enable row level security;
alter table public.tasks enable row level security;
alter table public.morning_sessions enable row level security;

create policy "own brands" on public.brands for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tasks" on public.tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sessions" on public.morning_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
