-- KorawitCinema — Migration 3: Staff POS support
-- รันไฟล์นี้ใน Supabase SQL Editor "หลังจาก" supabase_schema.sql และ
-- supabase_migration_auth_rls.sql เท่านั้น
--
-- เป็น migration แบบ additive-only: ไม่แก้/ไม่ลบตารางหรือ policy เดิม
-- แค่ (1) เพิ่ม read policy ให้ staff/admin เห็น booking ของลูกค้าทุกคนได้
-- (เดิมเห็นได้แค่ของตัวเอง ซึ่งใช้ไม่ได้กับหน้า Reservations/Ticketing ของพนักงาน)
-- และ (2) เพิ่มตารางใหม่ 3 ตารางสำหรับโมดูล Gift Card และ Shift Mgmt ที่ยังไม่มี
-- ใน schema เดิมเลย

--------------------------------------------------------------------------------
-- 1. Staff/Admin read-all policies (additive — เดิมมีแต่ "select own")
--------------------------------------------------------------------------------

create policy "staff read all bookings" on bookings
  for select to authenticated using (
    exists (select 1 from users u where u.user_id = auth.uid() and u.role in ('staff', 'admin'))
  );

create policy "staff read all booking_seats" on booking_seats
  for select to authenticated using (
    exists (select 1 from users u where u.user_id = auth.uid() and u.role in ('staff', 'admin'))
  );

create policy "staff read all booking_addons" on booking_addons
  for select to authenticated using (
    exists (select 1 from users u where u.user_id = auth.uid() and u.role in ('staff', 'admin'))
  );

create policy "staff read all payments" on payments
  for select to authenticated using (
    exists (select 1 from users u where u.user_id = auth.uid() and u.role in ('staff', 'admin'))
  );

--------------------------------------------------------------------------------
-- 1b. Walk-in / concession-only booking RPC
--------------------------------------------------------------------------------
-- bookings ไม่มี insert policy ให้ client เขียนตรงๆ (ตั้งใจ, ดู migration 2) —
-- ต้องผ่าน SECURITY DEFINER function เท่านั้น. hold_seat ต้องมีที่นั่งเสมอ ซึ่งไม่
-- ตรงกับการขาย "ของกินเล่นอย่างเดียว" ที่หน้า Concession ในหน้าจอ POS จึงเพิ่ม
-- ฟังก์ชันนี้ไว้เปิด booking เปล่า (0 ที่นั่ง, total_amount 0) แล้วให้ confirm_payment
-- เดิม (migration 2) จัดการ addons/payment/points ต่อได้ทันที ไม่ต้องแก้ confirm_payment

create or replace function public.create_walkin_booking(p_showtime_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'ต้องเข้าสู่ระบบก่อน');
  end if;

  if not exists (select 1 from users u where u.user_id = v_user_id and u.role in ('staff', 'admin')) then
    return jsonb_build_object('ok', false, 'message', 'ต้องเป็นพนักงานเท่านั้น');
  end if;

  insert into bookings (user_id, showtime_id, booking_code, status, total_amount, expires_at)
  values (v_user_id, p_showtime_id, public.generate_booking_code(), 'pending_payment', 0, now() + interval '10 minutes')
  returning booking_id into v_booking_id;

  return jsonb_build_object('ok', true, 'booking_id', v_booking_id);
end;
$$;

grant execute on function public.create_walkin_booking(uuid) to authenticated;

--------------------------------------------------------------------------------
-- 2. Gift cards
--------------------------------------------------------------------------------

create table gift_cards (
  gift_card_id    uuid primary key default gen_random_uuid(),
  code            varchar unique not null,
  initial_balance numeric not null,
  balance         numeric not null,
  status          varchar not null default 'active', -- active / redeemed / cancelled
  issued_to       varchar,
  issued_by       uuid references users(user_id),
  created_at      timestamptz not null default now()
);

create table gift_card_transactions (
  gift_card_txn_id uuid primary key default gen_random_uuid(),
  gift_card_id     uuid not null references gift_cards(gift_card_id),
  amount           numeric not null,
  type             varchar not null check (type in ('issue', 'redeem', 'reload')),
  staff_id         uuid references users(user_id),
  created_at       timestamptz not null default now()
);

alter table gift_cards enable row level security;
alter table gift_card_transactions enable row level security;

create policy "staff read gift_cards" on gift_cards
  for select to authenticated using (
    exists (select 1 from users u where u.user_id = auth.uid() and u.role in ('staff', 'admin'))
  );

create policy "staff write gift_cards" on gift_cards
  for insert to authenticated with check (
    exists (select 1 from users u where u.user_id = auth.uid() and u.role in ('staff', 'admin'))
  );

create policy "staff update gift_cards" on gift_cards
  for update to authenticated using (
    exists (select 1 from users u where u.user_id = auth.uid() and u.role in ('staff', 'admin'))
  );

create policy "staff read gift_card_transactions" on gift_card_transactions
  for select to authenticated using (
    exists (select 1 from users u where u.user_id = auth.uid() and u.role in ('staff', 'admin'))
  );

create policy "staff write gift_card_transactions" on gift_card_transactions
  for insert to authenticated with check (
    exists (select 1 from users u where u.user_id = auth.uid() and u.role in ('staff', 'admin'))
  );

--------------------------------------------------------------------------------
-- 3. Shift management
--------------------------------------------------------------------------------

create table staff_shifts (
  shift_id       uuid primary key default gen_random_uuid(),
  staff_id       uuid not null references users(user_id),
  clock_in       timestamptz not null default now(),
  clock_out      timestamptz,
  starting_cash  numeric,
  ending_cash    numeric,
  notes          text
);

alter table staff_shifts enable row level security;

create policy "staff read own shifts" on staff_shifts
  for select to authenticated using (
    staff_id = auth.uid()
    or exists (select 1 from users u where u.user_id = auth.uid() and u.role = 'admin')
  );

create policy "staff insert own shifts" on staff_shifts
  for insert to authenticated with check (staff_id = auth.uid());

create policy "staff update own shifts" on staff_shifts
  for update to authenticated using (staff_id = auth.uid());
