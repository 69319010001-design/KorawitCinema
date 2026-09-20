-- KorawitCinema — Migration 5: Add items to an already-paid booking
-- รันไฟล์นี้ใน Supabase SQL Editor เมื่อไหร่ก็ได้ (ไม่ต้องรอ migration อื่น) —
-- additive-only: เพิ่ม RPC ใหม่ 1 ตัว ไม่แก้/ไม่ลบของเดิม
--
-- ทำไมต้องมี RPC ใหม่: booking_addons/bookings/payments ไม่มี insert/update
-- policy ให้ client เขียนตรงๆ (ตั้งใจ, ดู migration 2) ต้องผ่าน SECURITY DEFINER
-- function เท่านั้น — แต่ confirm_payment (migration 2) ใช้ได้เฉพาะตอนบิลยัง
-- pending_payment อยู่ พอบิลจ่ายเงินแล้ว (confirmed) ก็ไม่มีทางเพิ่มรายการได้อีก
-- ฟังก์ชันนี้เปิดช่องให้พนักงานเพิ่มเครื่องดื่ม/ของกินเล่นลงบิลเก่าที่ confirmed
-- แล้วได้ โดยรวมยอดเข้ากับ payment เดิมของบิลนั้น (payments.booking_id เป็น
-- unique ในสคีมาเดิม สร้าง payment ใบที่สองให้บิลเดียวกันไม่ได้ จึงบวกยอดเพิ่ม
-- เข้า payment เดิมแทนที่จะสร้างใบใหม่)

create or replace function public.add_booking_addons(
  p_booking_id uuid,
  p_addons jsonb -- [{"addon_id": "...", "quantity": 2}, ...]
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking bookings%rowtype;
  v_item jsonb;
  v_addon_price numeric;
  v_qty int;
  v_added_total numeric := 0;
begin
  if not exists (select 1 from users u where u.user_id = v_user_id and u.role in ('staff', 'admin')) then
    return jsonb_build_object('ok', false, 'message', 'ต้องเป็นพนักงานเท่านั้น');
  end if;

  select * into v_booking from bookings where booking_id = p_booking_id;
  if v_booking is null then
    return jsonb_build_object('ok', false, 'message', 'ไม่พบรายการจอง');
  end if;
  if v_booking.status != 'confirmed' then
    return jsonb_build_object('ok', false, 'message', 'เพิ่มรายการได้เฉพาะบิลที่ชำระเงินแล้วเท่านั้น');
  end if;

  for v_item in select * from jsonb_array_elements(p_addons)
  loop
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty > 0 then
      select price into v_addon_price from addons where addon_id = (v_item->>'addon_id')::uuid;
      if v_addon_price is not null then
        insert into booking_addons (booking_id, addon_id, quantity, price_each)
        values (p_booking_id, (v_item->>'addon_id')::uuid, v_qty, v_addon_price)
        on conflict (booking_id, addon_id) do update
          set quantity = booking_addons.quantity + excluded.quantity;
        v_added_total := v_added_total + v_addon_price * v_qty;
      end if;
    end if;
  end loop;

  if v_added_total = 0 then
    return jsonb_build_object('ok', false, 'message', 'ไม่ได้เลือกรายการที่จะเพิ่ม');
  end if;

  update bookings set total_amount = total_amount + v_added_total where booking_id = p_booking_id;
  update payments set amount = amount + v_added_total where booking_id = p_booking_id;

  return jsonb_build_object('ok', true, 'added_total', v_added_total);
end;
$$;

grant execute on function public.add_booking_addons(uuid, jsonb) to authenticated;
