-- KorawitCinema — Supabase schema
-- ตรงกับ src/lib/types.ts / mock-data.ts จริง (ดู DATABASE_SCHEMA.md ประกอบ)
-- วิธีใช้: เปิด Supabase Dashboard -> SQL Editor -> วางทั้งไฟล์นี้ -> Run
--
-- หมายเหตุ: ใช้ uuid เป็น primary key (Supabase สร้าง gen_random_uuid() ให้ผ่าน
-- extension pgcrypto ที่เปิดอยู่แล้วโดย default) แทนการเดา id เองแบบฝั่ง mock data
-- ปัจจุบัน ("m1", "b-173...") — ตอนต่อแอปจริงต้องเปลี่ยนโค้ดฝั่ง client ให้ใช้ id
-- ที่ได้จาก insert แทนการสร้างเองด้วย

create extension if not exists pgcrypto;

--------------------------------------------------------------------------------
-- ENUMS
--------------------------------------------------------------------------------

create type user_role as enum ('customer', 'staff', 'admin');
create type booking_status as enum ('pending_payment', 'confirmed', 'cancelled', 'expired');
create type seat_hold_status as enum ('held', 'booked', 'released');

--------------------------------------------------------------------------------
-- 1. USERS & MEMBERSHIP
--------------------------------------------------------------------------------

create table users (
    user_id         uuid primary key default gen_random_uuid(),
    full_name       varchar(150) not null,
    email           varchar(150) unique not null,
    phone           varchar(20) unique,
    role            user_role not null default 'customer',
    member_tier     varchar(20) not null default 'basic'
                    check (member_tier in ('basic', 'silver', 'gold')),
    points_balance  integer not null default 0,
    created_at      timestamptz not null default now()
);

--------------------------------------------------------------------------------
-- 2. CINEMA STRUCTURE
--------------------------------------------------------------------------------

create table cinemas (
    cinema_id       uuid primary key default gen_random_uuid(),
    name            varchar(150) not null,
    address         text,
    city            varchar(100)
);

create table halls (
    hall_id         uuid primary key default gen_random_uuid(),
    cinema_id       uuid not null references cinemas(cinema_id) on delete cascade,
    name            varchar(50) not null,
    screen_type     varchar(30) not null default 'standard'
                    check (screen_type in ('standard', 'imax', '4dx', 'dolby')),
    total_rows      integer not null,
    total_columns   integer not null,
    unique (cinema_id, name)
);

create table seat_types (
    seat_type_id     uuid primary key default gen_random_uuid(),
    code             varchar(20) unique not null check (code in ('STANDARD', 'VIP', 'COUPLE')),
    label            varchar(50) not null,
    price_multiplier decimal(4,2) not null default 1.00
);

create table seats (
    seat_id         uuid primary key default gen_random_uuid(),
    hall_id         uuid not null references halls(hall_id) on delete cascade,
    seat_row        varchar(2) not null,
    seat_column     integer not null,
    seat_type_id    uuid not null references seat_types(seat_type_id),
    is_active       boolean not null default true,
    unique (hall_id, seat_row, seat_column)
);
create index idx_seats_hall on seats(hall_id);

--------------------------------------------------------------------------------
-- 3. MOVIE CATALOG
--------------------------------------------------------------------------------

create table genres (
    genre_id        uuid primary key default gen_random_uuid(),
    name            varchar(50) unique not null
);

create table movies (
    movie_id        uuid primary key default gen_random_uuid(),
    title           varchar(200) not null,
    title_local     varchar(200) not null,
    duration_min    integer not null,
    synopsis        text,
    age_rating      varchar(10),
    release_date    date,
    status          varchar(20) not null default 'now_showing'
                    check (status in ('now_showing', 'coming_soon', 'ended')),
    created_at      timestamptz not null default now()
);

-- ยังไม่มีในโค้ดฝั่งแอปตอนนี้ (genre_ids ถูกยัดเป็น array ในตัว movie object แทน)
-- แต่ถ้าต่อ Supabase จริงควรใช้ตารางนี้เป็น junction table ตามหลัก normalize
create table movie_genres (
    movie_id        uuid not null references movies(movie_id) on delete cascade,
    genre_id        uuid not null references genres(genre_id) on delete cascade,
    primary key (movie_id, genre_id)
);

--------------------------------------------------------------------------------
-- 4. SHOWTIME & PRICING
--------------------------------------------------------------------------------

create table showtimes (
    showtime_id     uuid primary key default gen_random_uuid(),
    movie_id        uuid not null references movies(movie_id),
    hall_id         uuid not null references halls(hall_id),
    language_audio  varchar(30) not null default 'original'
                    check (language_audio in ('original', 'dubbed_thai')),
    subtitle        varchar(30) check (subtitle in ('thai', 'english', 'none')),
    start_time      timestamptz not null,
    end_time        timestamptz not null,
    base_price      decimal(8,2) not null,
    status          varchar(20) not null default 'open'
                    check (status in ('open', 'soldout', 'cancelled')),
    check (end_time > start_time)
);
create index idx_showtimes_movie_time on showtimes(movie_id, start_time);
create index idx_showtimes_hall_time on showtimes(hall_id, start_time);

create table showtime_pricing (
    showtime_id     uuid not null references showtimes(showtime_id) on delete cascade,
    seat_type_id    uuid not null references seat_types(seat_type_id),
    price           decimal(8,2) not null,
    primary key (showtime_id, seat_type_id)
);

--------------------------------------------------------------------------------
-- 5. BOOKING & PAYMENT
--------------------------------------------------------------------------------

create table promotions (
    promotion_id    uuid primary key default gen_random_uuid(),
    code            varchar(30) unique not null,
    description     text,
    discount_type   varchar(20) not null check (discount_type in ('percent', 'fixed_amount')),
    discount_value  decimal(8,2) not null,
    valid_from      timestamptz not null default now(),
    valid_to        timestamptz not null default now() + interval '10 years',
    usage_limit     integer,
    is_active       boolean not null default true
);

create table bookings (
    booking_id      uuid primary key default gen_random_uuid(),
    user_id         uuid not null references users(user_id),
    showtime_id     uuid not null references showtimes(showtime_id),
    booking_code    varchar(12) unique not null,
    status          booking_status not null default 'pending_payment',
    total_amount    decimal(10,2) not null,
    discount_amount decimal(10,2) not null default 0,
    promotion_id    uuid references promotions(promotion_id),
    created_at      timestamptz not null default now(),
    expires_at      timestamptz not null
);

create table booking_seats (
    booking_seat_id uuid primary key default gen_random_uuid(),
    booking_id      uuid not null references bookings(booking_id) on delete cascade,
    showtime_id     uuid not null references showtimes(showtime_id),
    seat_id         uuid not null references seats(seat_id),
    price           decimal(8,2) not null,
    status          seat_hold_status not null default 'held',
    held_at         timestamptz not null default now()
);

-- หัวใจของการกันจองที่นั่งซ้อน: ที่นั่งเดียวกัน รอบฉายเดียวกัน จะมีสถานะ
-- held หรือ booked พร้อมกันได้แค่แถวเดียว
create unique index uniq_seat_per_showtime_active
    on booking_seats (showtime_id, seat_id)
    where status in ('held', 'booked');
create index idx_booking_seats_booking on booking_seats(booking_id);

create table payments (
    payment_id      uuid primary key default gen_random_uuid(),
    booking_id      uuid not null unique references bookings(booking_id),
    method          varchar(30) not null
                    check (method in ('credit_card', 'promptpay', 'true_money', 'line_pay')),
    amount          decimal(10,2) not null,
    provider_ref    varchar(100),
    paid_at         timestamptz,
    status          varchar(20) not null default 'pending'
                    check (status in ('pending', 'success', 'failed', 'refunded'))
);

-- ยังไม่มีในโค้ดฝั่งแอปตอนนี้ (แต้มบวกเข้า users.points_balance ตรงๆ) —
-- สร้างไว้ให้พร้อมใช้เป็น audit trail ตามดีไซน์ต้นฉบับ
create table user_points_log (
    log_id          uuid primary key default gen_random_uuid(),
    user_id         uuid not null references users(user_id),
    booking_id      uuid references bookings(booking_id),
    points_change   integer not null,
    reason          varchar(100),
    created_at      timestamptz not null default now()
);

--------------------------------------------------------------------------------
-- 6. ADD-ONS
--------------------------------------------------------------------------------

create table addons (
    addon_id        uuid primary key default gen_random_uuid(),
    name            varchar(100) not null,
    price           decimal(8,2) not null,
    is_active       boolean not null default true
);

create table booking_addons (
    booking_id      uuid not null references bookings(booking_id) on delete cascade,
    addon_id        uuid not null references addons(addon_id),
    quantity        integer not null default 1,
    price_each      decimal(8,2) not null,
    primary key (booking_id, addon_id)
);

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY
--------------------------------------------------------------------------------
-- Supabase เปิด PostgREST ให้ทุกตารางเรียกผ่าน API ได้ทันที ควรเปิด RLS ก่อน
-- ใช้งานจริงเสมอ ด้านล่างเปิดไว้ให้ทุกตาราง แต่ยังไม่ได้ใส่ policy เพราะต้องรู้ก่อน
-- ว่าจะผูก users.user_id เข้ากับ Supabase Auth (auth.uid()) แบบไหน — บอกได้เลยถ้า
-- อยากให้เขียน policy ต่อให้ครบ (เช่น "ผู้ใช้เห็นเฉพาะ booking ของตัวเอง")

alter table users enable row level security;
alter table cinemas enable row level security;
alter table halls enable row level security;
alter table seat_types enable row level security;
alter table seats enable row level security;
alter table genres enable row level security;
alter table movies enable row level security;
alter table movie_genres enable row level security;
alter table showtimes enable row level security;
alter table showtime_pricing enable row level security;
alter table promotions enable row level security;
alter table bookings enable row level security;
alter table booking_seats enable row level security;
alter table payments enable row level security;
alter table user_points_log enable row level security;
alter table addons enable row level security;
alter table booking_addons enable row level security;
