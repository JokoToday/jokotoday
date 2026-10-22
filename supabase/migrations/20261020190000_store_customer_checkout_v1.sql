-- Store-only customer checkout foundation. Checkout is hard-disabled by the
-- staging/production policy constraint until an explicitly reviewed rollout.
-- All amounts, stock and payment modes are server-derived; no public admin RPC.
create or replace function public.create_store_customer_order_v1(
 p_request_key uuid,
 p_lines jsonb,
 p_payment_mode text default 'kshop_master'
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_user uuid := auth.uid();
 v_customer public.user_profiles%rowtype;
 v_batch uuid;
 v_order uuid;
 v_payment uuid;
 v_product record;
 v_line record;
 v_count integer := 0;
 v_total numeric(10,2) := 0;
 v_items jsonb := '[]'::jsonb;
 v_expiry timestamptz;
 v_order_number text;
 v_existing record;
begin
 if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_request_key is null then raise exception 'Request key required'; end if;
 -- Serialize retries before consulting order state.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('store-checkout:'||p_request_key::text,0));
 select l.order_id,l.payment_transaction_id,b.state,o.customer_id,t.payment_mode
 into v_existing
 from public.store_reservation_batches b
 join public.store_payment_links l on l.batch_id=b.id
 join public.orders o on o.id=l.order_id
 join public.payment_transactions t on t.id=l.payment_transaction_id
 where b.request_key=p_request_key;
 if found then
   if v_existing.customer_id is distinct from v_user then raise exception 'Request key belongs to another customer' using errcode='42501'; end if;
   if v_existing.payment_mode is distinct from p_payment_mode then raise exception 'Payment method cannot change on retry'; end if;
   return jsonb_build_object('order_id',v_existing.order_id,'payment_transaction_id',v_existing.payment_transaction_id,'state',v_existing.state,'idempotent_replay',true);
 end if;
 -- No new orders may be made until the complete two-provider checkout is approved.
 if not exists(select 1 from public.store_payment_policy where policy_key='default' and checkout_enabled=true) then
   raise exception 'Store checkout is not yet enabled';
 end if;
 if p_payment_mode not in ('kshop_master','stripe_promptpay') then raise exception 'Unsupported Store payment method'; end if;
 if p_payment_mode='stripe_promptpay' and not exists (
   select 1 from public.store_payment_policy where policy_key='default' and fallback_enabled=true
 ) then raise exception 'Stripe PromptPay is not enabled for Store'; end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 40 then
   raise exception 'Invalid Store order items'; end if;
 if exists(select 1 from jsonb_array_elements(p_lines) l
   where jsonb_typeof(l)<>'object'
   or jsonb_typeof(l->'product_id')<>'string'
   or (l->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or jsonb_typeof(l->'quantity')<>'number'
   or (l->>'quantity') !~ '^[1-9][0-9]*$'
   or (l->>'quantity')::numeric>10000) then raise exception 'Invalid Store quantity or product'; end if;
 if exists(select 1 from (select l->>'product_id',count(*) from jsonb_array_elements(p_lines) l group by 1 having count(*)>1) d)
 then raise exception 'Duplicate Store product'; end if;
 select * into v_customer from public.user_profiles where id=v_user;
 if not found or length(btrim(coalesce(v_customer.name,'')))=0 or length(btrim(coalesce(v_customer.phone,'')))=0
 then raise exception 'Complete your customer name and phone before Store checkout'; end if;
 if p_payment_mode='stripe_promptpay' and length(btrim(coalesce(v_customer.email,'')))=0
 then raise exception 'Stripe PromptPay requires your email'; end if;
 v_expiry:=clock_timestamp()+interval '15 minutes';
 insert into public.store_reservation_batches(request_key,expires_at) values(p_request_key,v_expiry) returning id into v_batch;
 for v_line in
   select (l->>'product_id')::uuid product_id,(l->>'quantity')::integer quantity
   from jsonb_array_elements(p_lines) l order by (l->>'product_id')::uuid
 loop
   select p.id,p.price,p.name_en into v_product
   from public.cms_products p
   join public.store_product_assignments a on a.product_id=p.id and a.is_published
   join public.store_fulfillment_settings s on s.product_id=p.id
   where p.id=v_line.product_id and p.catalog_scope='store_only'
     and p.is_active=true and p.is_sold_out is not true
     and s.ordering_enabled=true and s.pickup_today=true
     and s.stock_on_hand-s.stock_reserved>=v_line.quantity
   for update of s;
   if not found or v_product.price<=0 then raise exception 'Store item unavailable'; end if;
   update public.store_fulfillment_settings set stock_reserved=stock_reserved+v_line.quantity,updated_at=now()
   where product_id=v_line.product_id and stock_on_hand-stock_reserved>=v_line.quantity;
   if not found then raise exception 'Insufficient Store stock'; end if;
   insert into public.store_reservation_items(batch_id,product_id,quantity,unit_price)
   values(v_batch,v_line.product_id,v_line.quantity,v_product.price);
   v_total:=v_total+(v_line.quantity*v_product.price);
   v_items:=v_items||jsonb_build_array(jsonb_build_object('product_id',v_line.product_id,'name',v_product.name_en,'quantity',v_line.quantity,'price',v_product.price));
   v_count:=v_count+1;
 end loop;
 if v_total<=0 then raise exception 'Invalid order total'; end if;
 v_order_number:='STO-'||upper(substr(replace(v_batch::text,'-',''),1,12));
 insert into public.orders(customer_id,order_number,order_items,total_amount,customer_name,customer_phone,customer_email,notes,order_type,pickup_date,purchase_type)
 values(v_user,v_order_number,v_items,v_total,v_customer.name,v_customer.phone,v_customer.email,'Store pickup today; awaiting payment','regular',timezone('Asia/Bangkok',now())::date,'online')
 returning id into v_order;
 insert into public.store_fulfillment_groups(batch_id,group_kind,method) values(v_batch,'store','pickup_today');
 insert into public.store_order_payment_modes(order_id,payment_mode) values(v_order,p_payment_mode);
 insert into public.payment_transactions(order_id,customer_id,amount_due,expires_at,payment_mode)
 values(v_order,v_user,v_total,v_expiry,p_payment_mode) returning id into v_payment;
 if not exists(select 1 from public.payment_transactions where id=v_payment and payment_mode=p_payment_mode and provider=case when p_payment_mode='stripe_promptpay' then 'stripe' else 'easyslip' end)
 then raise exception 'Payment provider snapshot mismatch'; end if;
 insert into public.store_payment_links(batch_id,order_id,payment_transaction_id,provider)
 values(v_batch,v_order,v_payment,p_payment_mode);
 update public.store_reservation_batches set amount_due=v_total where id=v_batch;
 return jsonb_build_object('order_id',v_order,'payment_transaction_id',v_payment,'order_number',v_order_number,'amount_due',v_total,'expires_at',v_expiry,'idempotent_replay',false);
end $$;
revoke all on function public.create_store_customer_order_v1(uuid,jsonb,text) from public,anon;
grant execute on function public.create_store_customer_order_v1(uuid,jsonb,text) to authenticated;
