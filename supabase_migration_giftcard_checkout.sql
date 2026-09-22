-- KorawitCinema — Migration 7: use gift cards at checkout
-- additive-only, run whenever (after migration 3 which creates gift_cards)
--
-- ทำไมต้องมีตัวนี้: หน้า Gift Card เดิมมีแค่ "ตรวจสอบ/ใช้บัตร" ซึ่งหักยอดบัตร
-- ลอย ๆ ไม่ได้ผูกกับบิลไหนเลย และช่อง "โค้ดส่วนลด" ที่หน้าชำระเงินเช็คแค่ตาราง
-- promotions เท่านั้น เอารหัสบัตรของขวัญไปกรอกจึงขึ้น "โค้ดไม่ถูกต้อง" เสมอ —
-- ฟังก์ชันนี้ทำให้เอาบัตรของขวัญมาหักลบยอดที่ต้องจ่ายของบิลจริงได้ตอนเช็คเอาท์
-- (เหมือน apply_promo แต่สำหรับบัตรของขวัญ ใช้ discount_amount ตัวเดียวกัน
-- รวมกันได้ทั้งโปรโมชันและบัตรของขวัญ)

create or replace function public.redeem_gift_card_for_booking(
  p_booking_id uuid,
  p_code text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking bookings%rowtype;
  v_card gift_cards%rowtype;
  v_applied numeric;
begin
  if not exists (select 1 from users u where u.user_id = v_user_id and u.role in ('staff', 'admin')) then
    return jsonb_build_object('ok', false, 'message', 'ต้องเป็นพนักงานเท่านั้น');
  end if;

  select * into v_booking from bookings where booking_id = p_booking_id;
  if v_booking is null then
    return jsonb_build_object('ok', false, 'message', 'ไม่พบรายการจอง');
  end if;
  if v_booking.status != 'pending_payment' then
    return jsonb_build_object('ok', false, 'message', 'รายการนี้ไม่ได้อยู่ระหว่างรอชำระเงิน');
  end if;

  select * into v_card from gift_cards where lower(code) = lower(trim(p_code)) for update;
  if v_card is null then
    return jsonb_build_object('ok', false, 'message', 'ไม่พบบัตรของขวัญรหัสนี้');
  end if;
  if v_card.status != 'active' then
    return jsonb_build_object('ok', false, 'message', 'บัตรนี้ใช้งานไม่ได้แล้ว');
  end if;

  v_applied := least(p_amount, v_card.balance, v_booking.total_amount);
  if v_applied <= 0 then
    return jsonb_build_object('ok', false, 'message', 'ไม่มีจำนวนเงินที่ใช้ได้ (บัตรไม่มียอดคงเหลือ หรือบิลนี้ไม่มียอดที่ต้องชำระ)');
  end if;

  update gift_cards
     set balance = balance - v_applied,
         status = case when balance - v_applied <= 0 then 'redeemed' else 'active' end
   where gift_card_id = v_card.gift_card_id;

  insert into gift_card_transactions (gift_card_id, amount, type, staff_id)
  values (v_card.gift_card_id, v_applied, 'redeem', v_user_id);

  update bookings
     set discount_amount = discount_amount + v_applied,
         total_amount = greatest(0, total_amount - v_applied)
   where booking_id = p_booking_id;

  return jsonb_build_object('ok', true, 'applied', v_applied, 'card_balance', v_card.balance - v_applied);
end;
$$;

grant execute on function public.redeem_gift_card_for_booking(uuid, text, numeric) to authenticated;
