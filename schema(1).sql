-- Run in Supabase SQL Editor. Safe to run once on a fresh project.
-- If you already ran the old schema, drop those tables first:
drop table if exists game_logs, badges, attributes, players cascade;

create table if not exists careers (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Player',
  position text not null default 'PG',
  team text not null default 'Free Agent',
  season int not null default 1,
  years_pro int not null default 0,
  overall int not null default 60,
  level int not null default 1,
  total_xp numeric not null default 0,
  vc numeric not null default 0,
  portrait_url text,
  last_played timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists attributes (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references careers(id) on delete cascade,
  category text not null,
  name text not null,
  value int not null default 25,
  xp numeric not null default 0,
  xp_needed numeric not null default 100
);

create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references careers(id) on delete cascade,
  category text not null,
  name text not null,
  description text,
  tier text not null default 'none',
  xp numeric not null default 0,
  xp_needed numeric not null default 300
);

create table if not exists game_logs (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references careers(id) on delete cascade,
  season int not null default 1,
  played_at date not null default current_date,
  opponent text,
  minutes numeric default 0,
  pts int not null default 0,
  reb int not null default 0,
  ast int not null default 0,
  stl int not null default 0,
  blk int not null default 0,
  tov int not null default 0,
  pf int not null default 0,
  fgm int not null default 0,
  fga int not null default 0,
  tpm int not null default 0,
  tpa int not null default 0,
  ftm int not null default 0,
  fta int not null default 0,
  plus_minus int not null default 0,
  win boolean not null default false,
  playoff boolean not null default false,
  finals boolean not null default false,
  championship boolean not null default false,
  clutch boolean not null default false,
  player_of_game boolean not null default false,
  xp_earned numeric not null default 0,
  vc_earned numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references careers(id) on delete cascade,
  season int not null default 1,
  salary numeric not null default 0,
  years_remaining int not null default 1,
  team_option boolean not null default false,
  player_option boolean not null default false,
  no_trade_clause boolean not null default false,
  bonuses numeric not null default 0,
  signed_at timestamptz not null default now()
);

create table if not exists awards (
  id uuid primary key default gen_random_uuid(),
  career_id uuid not null references careers(id) on delete cascade,
  season int not null default 1,
  award_name text not null,
  created_at timestamptz not null default now()
);

-- Personal single-user app: no auth, RLS left off. Don't share this app's URL publicly.

-- Migration: run this if your careers table already existed before this update
alter table careers add column if not exists height text;
alter table careers add column if not exists weight text;
alter table careers add column if not exists wingspan text;
