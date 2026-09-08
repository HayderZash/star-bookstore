insert into public.store_settings (key, value) values
  ('telegram_chat_id', '8080788386'),
  ('telegram_admin_username', 'HayderZash'),
  ('netlify_webhook_url', 'https://star-bookstore.netlify.app/api/public/telegram/order'),
  ('netlify_webhook_secret', '9c10707d879862322d8dbf18916406f5dc76cf083a550c90')
on conflict (key) do update set value = excluded.value;

drop policy if exists "settings public read" on public.store_settings;
create policy "settings public read"
  on public.store_settings
  for select
  to anon, authenticated
  using (key not in ('netlify_webhook_secret', 'proxy_secret'));

create policy "settings admin read all"
  on public.store_settings
  for select
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));