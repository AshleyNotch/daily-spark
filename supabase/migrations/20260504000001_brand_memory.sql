create table if not exists brand_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  session_id uuid references morning_sessions(id) on delete set null,
  session_date date not null,
  tasks_created int not null default 0,
  tasks_completed int not null default 0,
  tasks_incomplete int not null default 0,
  incomplete_task_titles text[] not null default '{}',
  session_notes text,
  created_at timestamptz not null default now()
);

alter table brand_memory enable row level security;

create policy "users_own_brand_memory"
  on brand_memory for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index brand_memory_lookup_idx
  on brand_memory (user_id, brand_id, session_date desc);
