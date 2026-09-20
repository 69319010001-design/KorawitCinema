-- KorawitCinema — one-time backfill: adds image_url to the addons rows that
-- were already inserted by an earlier run of supabase_migration_menu.sql
-- (before it had photos). Safe to run even if some rows don't exist yet —
-- each `update` just matches 0 rows and does nothing. Does NOT insert anything,
-- so it won't create duplicates.

update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Cinema_popcorn_bucket.jpg'
  where name = 'ป็อปคอร์นถังเล็ก + น้ำอัดลม 1 แก้ว';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Popcorn_in_bucket.jpg'
  where name = 'ป็อปคอร์นถังใหญ่ + โค้ก 2 แก้ว';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Nachos-cheese.jpg'
  where name = 'นาโช่ชีสดิป + น้ำอัดลม 1 แก้ว';

update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Popcorn.jpg'
  where name = 'ป็อปคอร์นรสธรรมชาติ ถังเล็ก';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Popcorn_(Back).jpg'
  where name = 'ป็อปคอร์นรสคาราเมล ถังกลาง';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Popcornopolis_cheddar_cheese_popcorn_1.JPG'
  where name = 'ป็อปคอร์นชีส ถังใหญ่';

update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Tumbler_of_cola_with_ice.jpg'
  where name = 'น้ำอัดลม แก้วเล็ก (โค้ก/สไปรท์/แฟนต้า)';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Ice_cubes_in_a_cup_of_soda.jpg'
  where name = 'น้ำอัดลม แก้วใหญ่';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Bottled_water.jpg'
  where name = 'น้ำดื่ม';

update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Nachos-cheese_(cropped).jpg'
  where name = 'นาโช่ชีสดิป (เดี่ยว)';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/HotDog.jpg'
  where name = 'ฮอทดอกชีส';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/French_Fries.JPG'
  where name = 'เฟรนช์ฟรายส์';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Fried_Chicken.jpg'
  where name = 'ไก่ทอด 3 ชิ้น';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Plain-M%26Ms-Pile.jpg'
  where name = 'ลูกอมช็อกโกแลต';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/VanillaIceCream.jpg'
  where name = 'ไอศกรีมวานิลลา';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Bubble_Tea_Drinks.jpg'
  where name = 'ชานมไข่มุก';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Iced_cold_brew_coffee.jpg'
  where name = 'กาแฟเย็น';
update addons set image_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/Glass_of_Iced_Tea.jpg'
  where name = 'ชาเขียวเย็น';
