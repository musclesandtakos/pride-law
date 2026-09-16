alter table public.profiles
  add column if not exists must_change_password boolean not null default false,
  add column if not exists temporary_password_expires_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_temporary_password_state_check;

alter table public.profiles
  add constraint profiles_temporary_password_state_check check (
    (must_change_password and temporary_password_expires_at is not null)
    or (not must_change_password and temporary_password_expires_at is null)
  );

create index if not exists profiles_temporary_password_expiry_idx
  on public.profiles (temporary_password_expires_at)
  where must_change_password;
