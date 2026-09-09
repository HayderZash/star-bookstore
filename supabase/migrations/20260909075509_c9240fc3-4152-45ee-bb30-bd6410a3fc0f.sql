
INSERT INTO public.store_settings (key, value)
VALUES ('telegram_bot_token', '8334750164:AAG0uTQyhg8os5gieHn6MhKNbmUaulRD1GI')
ON CONFLICT (key) DO UPDATE SET value = excluded.value;

DROP POLICY IF EXISTS "settings public read" ON public.store_settings;
CREATE POLICY "settings public read" ON public.store_settings
FOR SELECT
USING (key <> ALL (ARRAY['netlify_webhook_secret','proxy_secret','telegram_bot_token']));

CREATE OR REPLACE FUNCTION public.notify_order_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'net', 'extensions'
AS $function$
declare
  _token text; _chat text; _url text; _secret text;
  _order_id uuid; _o record; _lines text; _text text;
  _order jsonb; _items jsonb;
begin
  select order_id into _order_id from new_items limit 1;
  if _order_id is null then return null; end if;
  select * into _o from public.orders o where o.id = _order_id;
  if _o.id is null then return null; end if;

  select string_agg('• ' || i.product_name || ' × ' || i.quantity ||
                    ' — ' || round(i.unit_price)::text || ' د.ع', E'\n')
    into _lines from new_items i;

  _text := '🛒 طلب جديد #' || _o.order_number || E'\n' ||
           'الزبون: ' || coalesce(_o.customer_name,'') || E'\n' ||
           'الهاتف: ' || coalesce(_o.phone,'') || E'\n' ||
           'المحافظة: ' || coalesce(_o.governorate_name,'') || E'\n' ||
           case when coalesce(_o.landmark,'') <> '' then 'أقرب نقطة دالة: ' || _o.landmark || E'\n' else '' end ||
           case when coalesce(_o.preferred_delivery_time,'') <> '' then 'وقت التسليم المفضل: ' || _o.preferred_delivery_time || E'\n' else '' end ||
           E'\n' || coalesce(_lines,'—') || E'\n\n' ||
           'المجموع: ' || round(coalesce(_o.subtotal,0))::text || ' د.ع' || E'\n' ||
           'التوصيل: ' || round(coalesce(_o.shipping_fee,0))::text || ' د.ع' || E'\n' ||
           case when coalesce(_o.discount_amount,0) > 0
                then 'الخصم: -' || round(_o.discount_amount)::text || ' د.ع' || E'\n' else '' end ||
           'الإجمالي: ' || round(coalesce(_o.total_amount,0))::text || ' د.ع';

  select value into _token from public.store_settings where key = 'telegram_bot_token';
  select value into _chat from public.store_settings where key = 'telegram_chat_id';
  if _token is not null and btrim(_token) <> '' and _chat is not null and btrim(_chat) <> '' then
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || _token || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('chat_id', _chat, 'text', _text),
      timeout_milliseconds := 8000
    );
  end if;

  select value into _url from public.store_settings where key = 'netlify_webhook_url';
  select value into _secret from public.store_settings where key = 'netlify_webhook_secret';
  if _url is not null and btrim(_url) <> '' and _secret is not null and btrim(_secret) <> '' then
    select to_jsonb(o) into _order from public.orders o where o.id = _order_id;
    select coalesce(jsonb_agg(jsonb_build_object(
             'product_name', i.product_name,
             'quantity', i.quantity,
             'unit_price', i.unit_price)), '[]'::jsonb)
      into _items from new_items i;
    perform net.http_post(
      url := _url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', _secret),
      body := jsonb_build_object('order', _order, 'items', _items),
      timeout_milliseconds := 8000
    );
  end if;
  return null;
end;
$function$;
