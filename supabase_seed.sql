-- KorawitCinema — Seed data
-- รันหลัง supabase_schema.sql และ supabase_migration_auth_rls.sql
-- ข้อมูลเดียวกับที่เคยอยู่ใน src/lib/mock-data.ts

--------------------------------------------------------------------------------
-- Cinemas & Halls
--------------------------------------------------------------------------------

insert into cinemas (cinema_id, name, address, city) values
  ('10000000-0000-0000-0000-000000000001', 'KorawitCinema Central World', '999/9 ถ.พระราม 1 ปทุมวัน', 'กรุงเทพมหานคร'),
  ('10000000-0000-0000-0000-000000000002', 'KorawitCinema Siam Paragon', '991 ถ.พระราม 1 ปทุมวัน', 'กรุงเทพมหานคร');

insert into halls (hall_id, cinema_id, name, screen_type, total_rows, total_columns) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'โรง 1', 'standard', 8, 10),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'IMAX Hall', 'imax', 6, 12),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'โรง 3', 'standard', 8, 10),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'Dolby Hall', 'dolby', 7, 10);

--------------------------------------------------------------------------------
-- Seat types & Seats (สร้างที่นั่งอัตโนมัติต่อโรง: 3 แถวท้ายเป็น VIP, แถวสุดท้ายเป็น Couple)
--------------------------------------------------------------------------------

insert into seat_types (seat_type_id, code, label, price_multiplier) values
  ('30000000-0000-0000-0000-000000000001', 'STANDARD', 'Standard', 1.00),
  ('30000000-0000-0000-0000-000000000002', 'VIP', 'VIP', 1.50),
  ('30000000-0000-0000-0000-000000000003', 'COUPLE', 'Couple', 2.00);

do $$
declare
  h record;
  r int;
  c int;
  row_letter text;
  is_couple boolean;
  is_vip boolean;
  seat_type uuid;
  vip_start int;
  couple_row int;
  step int;
begin
  for h in select hall_id, total_rows, total_columns from halls loop
    vip_start := h.total_rows - 3;
    couple_row := h.total_rows - 1;
    for r in 0..h.total_rows - 1 loop
      is_couple := (r = couple_row);
      is_vip := (r >= vip_start and not is_couple);
      seat_type := case
        when is_couple then '30000000-0000-0000-0000-000000000003'::uuid
        when is_vip then '30000000-0000-0000-0000-000000000002'::uuid
        else '30000000-0000-0000-0000-000000000001'::uuid
      end;
      row_letter := chr(65 + r);
      step := case when is_couple then 2 else 1 end;
      c := 1;
      while c <= h.total_columns loop
        insert into seats (hall_id, seat_row, seat_column, seat_type_id, is_active)
        values (h.hall_id, row_letter, c, seat_type, true);
        c := c + step;
      end loop;
    end loop;
  end loop;
end $$;

--------------------------------------------------------------------------------
-- Genres & Movies
--------------------------------------------------------------------------------

insert into genres (genre_id, name) values
  ('40000000-0000-0000-0000-000000000001', 'Action'),
  ('40000000-0000-0000-0000-000000000002', 'Sci-Fi'),
  ('40000000-0000-0000-0000-000000000003', 'Drama'),
  ('40000000-0000-0000-0000-000000000004', 'Horror'),
  ('40000000-0000-0000-0000-000000000005', 'Thriller'),
  ('40000000-0000-0000-0000-000000000006', 'Animation'),
  ('40000000-0000-0000-0000-000000000007', 'Comedy');

insert into movies (movie_id, title, title_local, duration_min, synopsis, age_rating, release_date, status) values
  ('50000000-0000-0000-0000-000000000001', 'Galactic Drift', 'ล่องสมุทรจักรวาล', 128,
   'ลูกเรือของยานสำรวจต้องเอาชีวิตรอดหลังยานหลุดเข้าไปในห้วงอวกาศที่ไม่มีในแผนที่ใด ๆ พร้อมภารกิจตามหาทางกลับบ้านก่อนออกซิเจนจะหมด',
   'PG-13', '2026-08-01', 'now_showing'),
  ('50000000-0000-0000-0000-000000000002', 'The Last Ember', 'ประกายไฟดวงสุดท้าย', 110,
   'เรื่องราวของช่างตีเหล็กวัยชราผู้พยายามส่งต่อวิชาที่รักให้ลูกศิษย์คนสุดท้าย ก่อนเตาไฟของตระกูลจะดับลงตลอดกาล',
   'PG-13', '2026-08-10', 'now_showing'),
  ('50000000-0000-0000-0000-000000000003', 'Midnight Prowl', 'เงาแห่งเสียงกระซิบ', 101,
   'หลังย้ายเข้าบ้านหลังใหม่ ครอบครัวหนึ่งเริ่มได้ยินเสียงกระซิบยามค่ำคืนที่ไม่มีใครอธิบายได้',
   '18+', '2026-08-15', 'now_showing'),
  ('50000000-0000-0000-0000-000000000004', 'Skyward Bound', 'ปีกน้อยท้าฟ้ากว้าง', 95,
   'นกกระจอกตัวเล็กที่บินไม่เป็นออกเดินทางร่วมกับผองเพื่อนสัตว์ป่าเพื่อตามหาฝูงนกในตำนานที่อาศัยอยู่เหนือเมฆ',
   'G', '2026-09-20', 'coming_soon');

insert into movie_genres (movie_id, genre_id) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003'),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000004'),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000005'),
  ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000006'),
  ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000007');

--------------------------------------------------------------------------------
-- Addons & Promotions
--------------------------------------------------------------------------------

insert into addons (addon_id, name, price, is_active) values
  ('60000000-0000-0000-0000-000000000001', 'ป็อปคอร์นถังเล็ก + น้ำอัดลม 1 แก้ว', 99, true),
  ('60000000-0000-0000-0000-000000000002', 'ป็อปคอร์นถังใหญ่ + โค้ก 2 แก้ว', 169, true),
  ('60000000-0000-0000-0000-000000000003', 'นาโช่ชีสดิป + น้ำอัดลม 1 แก้ว', 129, true);

insert into promotions (promotion_id, code, description, discount_type, discount_value, valid_from, valid_to, usage_limit, is_active) values
  ('70000000-0000-0000-0000-000000000001', 'WELCOME50', 'ส่วนลด 50 บาท สำหรับสมาชิกใหม่', 'fixed_amount', 50, now() - interval '30 days', now() + interval '365 days', null, true),
  ('70000000-0000-0000-0000-000000000002', 'STUDENT10', 'ส่วนลด 10% สำหรับบัตรนักเรียน/นักศึกษา', 'percent', 10, now() - interval '30 days', now() + interval '365 days', null, true);

--------------------------------------------------------------------------------
-- Showtimes & Pricing (7 วันถัดจากวันนี้ x 2 สาขา ต่อหนังที่กำลังฉาย)
--------------------------------------------------------------------------------

do $$
declare
  m record;
  day_offset int;
  cinema_ids uuid[] := array[
    '10000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid
  ];
  halls_by_cinema jsonb := jsonb_build_object(
    '10000000-0000-0000-0000-000000000001', jsonb_build_array('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'),
    '10000000-0000-0000-0000-000000000002', jsonb_build_array('20000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004')
  );
  slots time[] := array['13:00'::time, '16:00'::time, '19:00'::time, '21:30'::time];
  cinema_id uuid;
  hall_options text[];
  hall_id uuid;
  slot_time time;
  base_price numeric;
  start_ts timestamptz;
  end_ts timestamptz;
  seed int := 0;
  new_showtime_id uuid;
begin
  for m in select movie_id, duration_min from movies where status = 'now_showing' loop
    seed := seed + 1;
    for day_offset in 0..6 loop
      foreach cinema_id in array cinema_ids loop
        hall_options := array(select jsonb_array_elements_text(halls_by_cinema -> cinema_id::text));
        hall_id := (hall_options[((day_offset + seed) % array_length(hall_options, 1)) + 1])::uuid;
        slot_time := slots[((day_offset + seed) % array_length(slots, 1)) + 1];
        base_price := case hall_id
          when '20000000-0000-0000-0000-000000000001'::uuid then 160
          when '20000000-0000-0000-0000-000000000002'::uuid then 220
          when '20000000-0000-0000-0000-000000000003'::uuid then 160
          when '20000000-0000-0000-0000-000000000004'::uuid then 200
        end;
        start_ts := (current_date + day_offset)::timestamp + slot_time;
        end_ts := start_ts + (m.duration_min::text || ' minutes')::interval;

        insert into showtimes (movie_id, hall_id, language_audio, subtitle, start_time, end_time, base_price, status)
        values (
          m.movie_id, hall_id,
          case when seed % 2 = 0 then 'original' else 'dubbed_thai' end,
          'thai', start_ts, end_ts, base_price, 'open'
        )
        returning showtime_id into new_showtime_id;

        insert into showtime_pricing (showtime_id, seat_type_id, price) values
          (new_showtime_id, '30000000-0000-0000-0000-000000000001', base_price),
          (new_showtime_id, '30000000-0000-0000-0000-000000000002', round(base_price * 1.5)),
          (new_showtime_id, '30000000-0000-0000-0000-000000000003', round(base_price * 2));
      end loop;
    end loop;
  end loop;
end $$;
