-- KorawitCinema — Migration 4: Concession menu expansion
-- รันไฟล์นี้ใน Supabase SQL Editor เมื่อไหร่ก็ได้ (ไม่ต้องรอ migration 3) — เป็น
-- additive-only เหมือนกัน: ไม่แก้/ไม่ลบของเดิม แค่ (1) เพิ่มคอลัมน์ image_url
-- ให้ addons เผื่อใส่รูปสินค้าจริงทีหลัง และ (2) เพิ่มเมนูใหม่ให้เลือกเยอะขึ้น —
-- แยกป็อปคอร์น/น้ำอัดลมออกจากคอมโบเดิม 3 ตัว แล้วเพิ่มของกินเล่นอื่น ๆ อีก 9 อย่าง
--
-- รูปภาพทั้งหมดดึงมาจาก Wikimedia Commons ผ่าน Special:FilePath (ลิงก์ตรงที่
-- Wikimedia รองรับให้ hotlink ได้ทางการ, รูปเป็น public domain / Creative Commons)
-- เป็นรูปตัวอย่างเพื่อให้หน้า Concession ดูมีของจริงทันที — เปลี่ยนเป็นรูปสินค้า
-- จริงของร้านทีหลังได้ด้วยคำสั่ง update ท้ายไฟล์

alter table addons add column if not exists image_url text;

-- ใส่รูปให้คอมโบ 3 ตัวที่มีอยู่แล้ว (seed เดิมจาก supabase_seed.sql)
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Cinema_popcorn_bucket.jpg'
  where name = 'ป็อปคอร์นถังเล็ก + น้ำอัดลม 1 แก้ว';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Popcorn_in_bucket.jpg'
  where name = 'ป็อปคอร์นถังใหญ่ + โค้ก 2 แก้ว';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Nachos-cheese.jpg'
  where name = 'นาโช่ชีสดิป + น้ำอัดลม 1 แก้ว';

-- ป็อปคอร์นแยก (ไม่พ่วงน้ำ)
insert into addons (name, price, is_active, image_url) values
  ('ป็อปคอร์นรสธรรมชาติ ถังเล็ก', 59, true, 'https://commons.wikimedia.org/wiki/Special:FilePath/Popcorn.jpg'),
  ('ป็อปคอร์นรสคาราเมล ถังกลาง', 79, true, 'https://commons.wikimedia.org/wiki/Special:FilePath/Popcorn_(Back).jpg'),
  ('ป็อปคอร์นชีส ถังใหญ่', 99, true, 'https://commons.wikimedia.org/wiki/Special:FilePath/Popcornopolis_cheddar_cheese_popcorn_1.JPG');

-- น้ำอัดลมแยก
insert into addons (name, price, is_active, image_url) values
  ('น้ำอัดลม แก้วเล็ก (โค้ก/สไปรท์/แฟนต้า)', 35, true, 'https://commons.wikimedia.org/wiki/Special:FilePath/Tumbler_of_cola_with_ice.jpg'),
  ('น้ำอัดลม แก้วใหญ่', 50, true, 'https://commons.wikimedia.org/wiki/Special:FilePath/Ice_cubes_in_a_cup_of_soda.jpg'),
  ('น้ำดื่ม', 20, true, 'https://commons.wikimedia.org/wiki/Special:FilePath/Bottled_water.jpg');

-- ของกินเล่นเพิ่มเติม
insert into addons (name, price, is_active, image_url) values
  ('นาโช่ชีสดิป (เดี่ยว)', 79, true, 'https://commons.wikimedia.org/wiki/Special:FilePath/Nachos-cheese_(cropped).jpg'),
  ('ฮอทดอกชีส', 65, true, 'https://commons.wikimedia.org/wiki/Special:FilePath/HotDog.jpg'),
  ('เฟรนช์ฟรายส์', 59, true, 'https://commons.wikimedia.org/wiki/Special:FilePath/French_Fries.JPG'),
  ('ไก่ทอด 3 ชิ้น', 89, true, 'https://commons.wikimedia.org/wiki/Special:FilePath/Fried_Chicken.jpg'),
  ('ลูกอมช็อกโกแลต', 45, true, 'https://commons.wikimedia.org/wiki/Special:FilePath/Plain-M%26Ms-Pile.jpg'),
  ('ไอศกรีมวานิลลา', 49, true, 'https://commons.wikimedia.org/wiki/Special:FilePath/VanillaIceCream.jpg'),
  ('ชานมไข่มุก', 65, true, 'https://commons.wikimedia.org/wiki/Special:FilePath/Bubble_Tea_Drinks.jpg'),
  ('กาแฟเย็น', 55, true, 'https://commons.wikimedia.org/wiki/Special:FilePath/Iced_cold_brew_coffee.jpg'),
  ('ชาเขียวเย็น', 45, true, 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_Iced_Tea.jpg');

-- ใส่รูปสินค้าจริงของร้านทีหลังได้ด้วย (แทนที่รูปตัวอย่างจาก Wikimedia):
--   update addons set image_url = 'https://...' where name = 'ป็อปคอร์นรสธรรมชาติ ถังเล็ก';
