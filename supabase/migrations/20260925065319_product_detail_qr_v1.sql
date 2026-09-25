-- Product detail + permanent product QR foundation
-- Additive migration only. Existing sample products remain untouched unless explicitly seeded below.

alter table public.cms_products
  add column if not exists public_code text,
  add column if not exists short_desc_en text,
  add column if not exists short_desc_th text,
  add column if not exists short_desc_zh text,
  add column if not exists joko_note_en text,
  add column if not exists joko_note_th text,
  add column if not exists joko_note_zh text,
  add column if not exists ingredients_en text,
  add column if not exists ingredients_th text,
  add column if not exists ingredients_zh text,
  add column if not exists allergens_en text,
  add column if not exists allergens_th text,
  add column if not exists allergens_zh text,
  add column if not exists storage_en text,
  add column if not exists storage_th text,
  add column if not exists storage_zh text,
  add column if not exists best_enjoyed_en text,
  add column if not exists best_enjoyed_th text,
  add column if not exists best_enjoyed_zh text,
  add column if not exists reheating_en text,
  add column if not exists reheating_th text,
  add column if not exists reheating_zh text;

create unique index if not exists cms_products_public_code_ci_unique
  on public.cms_products (upper(public_code))
  where public_code is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cms_products_public_code_format'
      and conrelid = 'public.cms_products'::regclass
  ) then
    alter table public.cms_products
      add constraint cms_products_public_code_format
      check (
        public_code is null
        or public_code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'
      );
  end if;
end
$$;

comment on column public.cms_products.public_code is
  'Permanent public product identifier used by printed QR routes such as /p/AC101. Public, non-secret, and stable across normal product edits.';

comment on column public.cms_products.qr_code_url is
  'Legacy uploaded product QR image URL. Deprecated for new product QR generation; retained for compatibility.';

-- Prototype #1 only. Other current products are samples and intentionally receive no permanent QR code.
update public.cms_products
set
  public_code = 'AC101',
  price = 60.00,
  name_th = 'ครัวซองต์อัลมอนด์',
  short_desc_en = 'Flaky • almond cream • lightly dusted',
  short_desc_th = 'กรอบเป็นชั้น • ครีมอัลมอนด์ • โรยไอซิ่งเบา ๆ',
  short_desc_zh = '层次酥香 • 杏仁奶油馅 • 轻撒糖粉',
  desc_en = 'A buttery croissant filled and topped with almond cream, finished with sliced almonds and a light dusting of sugar.',
  desc_th = 'ครัวซองต์เนยหอม สอดไส้และท็อปด้วยครีมอัลมอนด์ โรยด้วยอัลมอนด์สไลซ์และน้ำตาลไอซิ่งบาง ๆ',
  desc_zh = '黄油可颂内外搭配杏仁奶油，表面铺上杏仁片，再轻轻撒上糖粉。',
  joko_note_en = 'Best for slow mornings and coffee nearby.',
  joko_note_th = 'เหมาะกับเช้าที่ไม่รีบ และกาแฟดี ๆ สักแก้ว',
  joko_note_zh = '很适合慢一点的早晨，再配一杯咖啡刚刚好。',
  updated_at = now()
where slug = 'almond-croissant';