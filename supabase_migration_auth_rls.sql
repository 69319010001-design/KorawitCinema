-- KorawitCinema — Migration 2: Auth wiring + RLS + booking logic as real DB functions
-- รันไฟล์นี้ใน Supabase SQL Editor "หลังจาก" supabase_schema.sql เท่านั้น
--
-- แนวคิดหลัก: การกันจองที่นั่งซ้อน (unique partial index ที่มีอยู่แล้ว) เป็นแค่
-- ครึ่งเดียวของเรื่อง — ถ้าปล่อยให้ client เขียนตาราง bookings/booking_seats ตรงๆ
-- ผ่าน RLS แบบ "เจ้าของแก้ได้" อย่างเดียว จะมีช่องโหว่ตรงที่ user คนหนึ่งไม่มีสิทธิ์
-- ไป "ปลดล็อก" ที่นั่งที่หมดเวลาไปแล้วของคนอื่น (เพราะไม่ใช่เจ้าของ) ที่นั่งจะค้าง
-- ตลอดกาล จึงย้าย logic การจอง/ปล่อย/ยืนยันทั้งหมดไปเป็น Postgres function แบบ
-- SECURITY DEFINER แทน แล้วปิดไม่ให้ client เขียนตารางเหล่านี้ตรงๆ เลย (RLS ไม่มี
-- policy insert/update ให้ = ปฏิเสธเสมอ) บังคับให้ทุกการเขียนต้องผ่านฟังก์ชันเท่านั้น

--------------------------------------------------------------------------------
-- 1. ผูก users เข้ากับ Supabase Auth
--------------------------------------------------------------------------------

alter table users alter column user_id drop default;
alter table users
  add constraint users_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (user_id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

--------------------------------------------------------------------------------
-- 2. RLS policies
--------------------------------------------------------------------------------

-- แคตตาล็อก: อ่านได้ทุกคนไม่ต้อง login (สำหรับ browse หน้าแรก/รายละเอียดหนัง)
create policy "public read cinemas" on cinemas for select using (true);
create policy "public read halls" on halls for select using (true);
create policy "public read seat_types" on seat_types for select using (true);
create policy "public read seats" on seats for select using (true);
create policy "public read genres" on genres for select using (true);
create policy "public read movies" on movies for select using (true);
create policy "public read movie_genres" on movie_genres for select using (true);
create policy "public read showtimes" on showtimes for select using (true);
create policy "public read showtime_pricing" on showtime_pricing for select using (true);
create policy "public read addons" on addons for select using (true);
create policy "public read promotions" on promotions for select using (true);

-- ข้อมูลส่วนตัว: เห็น/แก้ได้เฉพาะของตัวเอง
create policy "users select own" on users for select using (auth.uid() = user_id);
create policy "users update own" on users for update using (auth.uid() = user_id);

create policy "bookings select own" on bookings for select using (auth.uid() = user_id);

-- ต้อง select ได้ทุกแถว (ไม่ใช่แค่ของตัวเอง) เพราะผังที่นั่งต้องรู้ว่าที่นั่งไหน
-- ถูกคนอื่นจองไปแล้วบ้าง — ไม่มี insert/update policy ตรงนี้โดยตั้งใจ
create policy "booking_seats select all authenticated" on booking_seats
  for select to authenticated using (true);

create policy "payments select own" on payments for select using (
  exists (select 1 from bookings b where b.booking_id = payments.booking_id and b.user_id = auth.uid())
);

create policy "booking_addons select own" on booking_addons for select using (
  exists (select 1 from bookings b where b.booking_id = booking_addons.booking_id and b.user_id = auth.uid())
);

--------------------------------------------------------------------------------
-- 3. View สำหรับผังที่นั่ง: คำนวณว่าที่นั่งไหน "ยังจองอยู่จริง" (ไม่รวม held ที่หมดเวลาแล้ว)
--------------------------------------------------------------------------------

create view public.active_booking_seats
with (security_invoker = false) as
select bs.booking_seat_id, bs.booking_id, bs.showtime_id, bs.seat_id, bs.status
from booking_seats bs
join bookings b on b.booking_id = bs.booking_id
where bs.status = 'booked'
   or (bs.status = 'held' and b.expires_at > now());

grant select on public.active_booking_seats to authenticated;

--------------------------------------------------------------------------------
-- 4. RPC functions — ทางเดียวที่เขียนลง bookings/booking_seats/payments ได้
--------------------------------------------------------------------------------

create or replace function public.generate_booking_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i int;
begin
  loop
    result := 'KC';
    for i in 1..6 loop
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from bookings where booking_code = result);
  end loop;
  return result;
end;
$$;

-- จองที่นั่งทีละใบทันทีที่กดเลือก (ตรงกับพฤติกรรมหน้าเลือกที่นั่งในเว็บ)
create or replace function public.hold_seat(p_showtime_id uuid, p_seat_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking_id uuid;
  v_price numeric;
  v_stale record;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'message', 'ต้องเข้าสู่ระบบก่อน');
  end if;

  -- ปล่อยที่นั่งที่ hold ค้างไว้แต่หมดเวลาไปแล้วของ "ใครก็ตาม" ก่อน
  -- (ทำได้เพราะฟังก์ชันนี้เป็น security definer ไม่ติด RLS ของ bookings คนอื่น)
  for v_stale in
    select bs.booking_seat_id, bs.booking_id
    from booking_seats bs
    join bookings b on b.booking_id = bs.booking_id
    where bs.showtime_id = p_showtime_id
      and bs.seat_id = p_seat_id
      and bs.status = 'held'
      and b.expires_at <= now()
  loop
    update booking_seats set status = 'released' where booking_seat_id = v_stale.booking_seat_id;
    update bookings set status = 'expired' where booking_id = v_stale.booking_id and status = 'pending_payment';
  end loop;

  select booking_id into v_booking_id
  from bookings
  where user_id = v_user_id and showtime_id = p_showtime_id and status = 'pending_payment'
  limit 1;

  if v_booking_id is null then
    insert into bookings (user_id, showtime_id, booking_code, status, total_amount, expires_at)
    values (v_user_id, p_showtime_id, public.generate_booking_code(), 'pending_payment', 0, now() + interval '10 minutes')
    returning booking_id into v_booking_id;
  end if;

  select st.price into v_price
  from seats s
  join showtime_pricing st on st.seat_type_id = s.seat_type_id and st.showtime_id = p_showtime_id
  where s.seat_id = p_seat_id;

  if v_price is null then
    return jsonb_build_object('ok', false, 'message', 'ไม่พบราคาที่นั่งนี้สำหรับรอบฉายนี้');
  end if;

  begin
    insert into booking_seats (booking_id, showtime_id, seat_id, price, status)
    values (v_booking_id, p_showtime_id, p_seat_id, v_price, 'held');
  exception when unique_violation then
    -- ผู้ใช้อีกคนแทรกได้ก่อนในเสี้ยววินาทีเดียวกัน — unique partial index กันไว้ตรงนี้เอง
    return jsonb_build_object('ok', false, 'message', 'ที่นั่งนี้เพิ่งถูกจองไปโดยผู้ใช้อื่น กรุณาเลือกที่นั่งอื่น');
  end;

  update bookings set total_amount = total_amount + v_price where booking_id = v_booking_id;

  return jsonb_build_object('ok', true, 'booking_id', v_booking_id);
end;
$$;

grant execute on function public.hold_seat(uuid, uuid) to authenticated;

-- ยกเลิกที่นั่งที่ตัวเองเพิ่งเลือกไว้ (ยังไม่จ่ายเงิน)
create or replace function public.release_seat(p_booking_id uuid, p_seat_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_price numeric;
  v_remaining int;
begin
  select bs.price into v_price
  from booking_seats bs
  join bookings b on b.booking_id = bs.booking_id
  where bs.booking_id = p_booking_id
    and bs.seat_id = p_seat_id
    and bs.status = 'held'
    and b.user_id = v_user_id;

  if v_price is null then
    return jsonb_build_object('ok', false, 'message', 'ไม่พบที่นั่งนี้ในรายการจองของคุณ');
  end if;

  delete from booking_seats where booking_id = p_booking_id and seat_id = p_seat_id and status = 'held';
  update bookings set total_amount = greatest(0, total_amount - v_price) where booking_id = p_booking_id;

  select count(*) into v_remaining from booking_seats where booking_id = p_booking_id and status = 'held';
  if v_remaining = 0 then
    update bookings set status = 'cancelled' where booking_id = p_booking_id and status = 'pending_payment';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.release_seat(uuid, uuid) to authenticated;

-- ใช้โค้ดส่วนลด
create or replace function public.apply_promo(p_booking_id uuid, p_code text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_promo record;
  v_seat_total numeric;
  v_used_count int;
begin
  select * into v_promo from promotions
  where lower(code) = lower(trim(p_code)) and is_active = true
    and now() between valid_from and valid_to;

  if v_promo is null then
    return jsonb_build_object('ok', false, 'message', 'โค้ดส่วนลดไม่ถูกต้องหรือหมดอายุ');
  end if;

  if v_promo.usage_limit is not null then
    select count(*) into v_used_count from bookings
    where promotion_id = v_promo.promotion_id and status = 'confirmed';
    if v_used_count >= v_promo.usage_limit then
      return jsonb_build_object('ok', false, 'message', 'โค้ดนี้ถูกใช้ครบจำนวนแล้ว');
    end if;
  end if;

  select coalesce(sum(price), 0) into v_seat_total
  from booking_seats where booking_id = p_booking_id and status = 'held';

  update bookings
     set promotion_id = v_promo.promotion_id,
         discount_amount = case when v_promo.discount_type = 'percent'
                                 then round(v_seat_total * v_promo.discount_value / 100)
                                 else v_promo.discount_value end,
         total_amount = greatest(0, v_seat_total - (case when v_promo.discount_type = 'percent'
                                 then round(v_seat_total * v_promo.discount_value / 100)
                                 else v_promo.discount_value end))
   where booking_id = p_booking_id and user_id = v_user_id and status = 'pending_payment';

  if not found then
    return jsonb_build_object('ok', false, 'message', 'ไม่พบรายการจอง หรือหมดเวลาชำระเงินแล้ว');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.apply_promo(uuid, text) to authenticated;

-- ยืนยันชำระเงิน: seats -> booked, booking -> confirmed, สร้าง payment + booking_addons, บวกแต้ม
create or replace function public.confirm_payment(
  p_booking_id uuid,
  p_method text,
  p_addons jsonb default '[]'::jsonb  -- [{"addon_id": "...", "quantity": 2}, ...]
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking bookings%rowtype;
  v_addon_total numeric := 0;
  v_final_total numeric;
  v_item jsonb;
  v_addon_price numeric;
begin
  select * into v_booking from bookings where booking_id = p_booking_id and user_id = v_user_id;

  if v_booking is null then
    return jsonb_build_object('ok', false, 'message', 'ไม่พบรายการจอง');
  end if;

  if v_booking.status = 'pending_payment' and v_booking.expires_at <= now() then
    update bookings set status = 'expired' where booking_id = p_booking_id;
    update booking_seats set status = 'released' where booking_id = p_booking_id and status = 'held';
    return jsonb_build_object('ok', false, 'message', 'หมดเวลาชำระเงิน ที่นั่งถูกปล่อยคืนแล้ว กรุณาเลือกที่นั่งใหม่');
  end if;

  if v_booking.status != 'pending_payment' then
    return jsonb_build_object('ok', false, 'message', 'รายการนี้ถูกดำเนินการไปแล้ว');
  end if;

  for v_item in select * from jsonb_array_elements(p_addons)
  loop
    select price into v_addon_price from addons where addon_id = (v_item->>'addon_id')::uuid;
    if v_addon_price is not null then
      v_addon_total := v_addon_total + v_addon_price * (v_item->>'quantity')::int;
      insert into booking_addons (booking_id, addon_id, quantity, price_each)
      values (p_booking_id, (v_item->>'addon_id')::uuid, (v_item->>'quantity')::int, v_addon_price);
    end if;
  end loop;

  v_final_total := v_booking.total_amount + v_addon_total;

  update bookings set status = 'confirmed', total_amount = v_final_total where booking_id = p_booking_id;
  update booking_seats set status = 'booked' where booking_id = p_booking_id and status = 'held';

  insert into payments (booking_id, method, amount, provider_ref, paid_at, status)
  values (
    p_booking_id, p_method, v_final_total,
    'MOCK-' || upper(substr(md5(random()::text), 1, 8)),
    now(), 'success'
  );

  update users set points_balance = points_balance + floor(v_final_total / 20)
  where user_id = v_user_id;

  return jsonb_build_object('ok', true, 'booking_id', p_booking_id, 'total_amount', v_final_total);
end;
$$;

grant execute on function public.confirm_payment(uuid, text, jsonb) to authenticated;

--------------------------------------------------------------------------------
-- 5. Realtime — ให้หน้าเลือกที่นั่งเห็นการจอง/ปล่อยที่นั่งของคนอื่นแบบสด ๆ
--------------------------------------------------------------------------------

alter publication supabase_realtime add table public.booking_seats;
