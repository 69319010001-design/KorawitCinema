-- KorawitCinema — Migration 9: fix infinite recursion on users RLS (URGENT)
-- รันไฟล์นี้ทันที — migration 8 (supabase_migration_cashier_core.sql) เพิ่ม
-- policy บนตาราง users ที่ query ตาราง users เองจากข้างใน policy ของ users
-- เอง ทำให้ Postgres วน RLS ซ้ำไม่รู้จบ (infinite recursion detected in
-- policy for relation "users") ออกมาเป็น 500 ทุกครั้งที่มีใคร select จาก
-- users — ซึ่งพังตั้งแต่ตอนล็อกอิน (fetchProfile) เลย ไม่ว่าจะเป็น role ไหน
--
-- ทางแก้: ย้ายการเช็ค role='admin' ไปไว้ในฟังก์ชัน SECURITY DEFINER แยก
-- ต่างหาก ฟังก์ชันนี้ query users โดยไม่ติด RLS ของ users เอง (รันด้วยสิทธิ์
-- เจ้าของฟังก์ชัน ไม่ใช่สิทธิ์ผู้เรียก) จึงตัดวงจร recursion ได้

drop policy if exists "admin read all users" on users;
drop policy if exists "admin update user roles" on users;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from users where user_id = auth.uid() and role = 'admin'
  );
$$;

create policy "admin read all users" on users
  for select to authenticated using (public.is_admin());

create policy "admin update user roles" on users
  for update to authenticated using (public.is_admin());
