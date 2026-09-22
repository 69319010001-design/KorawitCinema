-- KorawitCinema — Migration 8: real cashier-counter essentials
-- additive-only, run whenever. Covers three things a real cashier/counter
-- system can't work without, that the POS build so far was missing:
--
-- 1) Cash as a payment method (payments.method has a check constraint that
--    didn't include it — every other method already worked)
-- 2) Voiding/refunding a bill after it's been paid (there was previously no
--    way to undo a mistaken sale at all)
-- 3) An admin screen to promote a signed-up account to staff/admin, instead
--    of hand-editing the users table in the SQL editor every time

--------------------------------------------------------------------------------
-- 1. Cash payments
--------------------------------------------------------------------------------

alter table payments drop constraint if exists payments_method_check;
alter table payments add constraint payments_method_check
  check (method in ('cash', 'credit_card', 'promptpay', 'true_money', 'line_pay'));

--------------------------------------------------------------------------------
-- 2. Void / refund a confirmed booking (admin only)
--------------------------------------------------------------------------------

alter table payments add column if not exists refund_reason text;

create or replace function public.void_booking(p_booking_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking bookings%rowtype;
begin
  if not exists (select 1 from users u where u.user_id = v_user_id and u.role = 'admin') then
    return jsonb_build_object('ok', false, 'message', 'ต้องเป็นแอดมินเท่านั้นถึงจะยกเลิก/คืนเงินได้');
  end if;

  select * into v_booking from bookings where booking_id = p_booking_id;
  if v_booking is null then
    return jsonb_build_object('ok', false, 'message', 'ไม่พบรายการจอง');
  end if;
  if v_booking.status != 'confirmed' then
    return jsonb_build_object('ok', false, 'message', 'ยกเลิก/คืนเงินได้เฉพาะบิลที่ชำระเงินแล้วเท่านั้น');
  end if;

  update bookings set status = 'cancelled' where booking_id = p_booking_id;
  update booking_seats set status = 'released' where booking_id = p_booking_id and status = 'booked';
  update payments set status = 'refunded', refund_reason = p_reason where booking_id = p_booking_id;

  -- แต้มที่เคยบวกให้ตอน confirm_payment (floor(total/20)) ต้องหักคืนด้วย
  update users
     set points_balance = greatest(0, points_balance - floor(v_booking.total_amount / 20))
   where user_id = v_booking.user_id;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.void_booking(uuid, text) to authenticated;

--------------------------------------------------------------------------------
-- 3. Admin: view all users + change roles (existing policies only let a
--    user see/edit their own row)
--------------------------------------------------------------------------------

create policy "admin read all users" on users
  for select to authenticated using (
    exists (select 1 from users u where u.user_id = auth.uid() and u.role = 'admin')
  );

create policy "admin update user roles" on users
  for update to authenticated using (
    exists (select 1 from users u where u.user_id = auth.uid() and u.role = 'admin')
  );
