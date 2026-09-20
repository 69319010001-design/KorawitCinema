-- KorawitCinema — Migration 6: movie posters
-- additive-only: เพิ่มคอลัมน์ poster_url (nullable) ให้ movies ไม่แตะข้อมูลเดิม
-- ถ้ายังไม่มีรูป หน้าเว็บจะแสดงสีไล่เฉดแบบเดิม

alter table movies add column if not exists poster_url text;

-- หลังวางไฟล์รูปไว้ที่ public/posters/ ในโปรเจกต์แล้ว (push ขึ้น GitHub ด้วย) ให้รัน:
update movies set poster_url = '/posters/galactic-drift.jpg'   where title = 'Galactic Drift';
update movies set poster_url = '/posters/the-last-ember.jpg'   where title = 'The Last Ember';
update movies set poster_url = '/posters/midnight-prowl.jpg'   where title = 'Midnight Prowl';
-- update movies set poster_url = '/posters/skyward-bound.jpg'    where title = 'Skyward Bound';
