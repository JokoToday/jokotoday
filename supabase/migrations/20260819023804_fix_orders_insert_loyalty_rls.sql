-- Allow the database's BEFORE INSERT loyalty trigger to calculate
-- loyalty_points_earned without causing the customer INSERT RLS check to fail.
--
-- All other customer-order restrictions remain unchanged.
DROP POLICY IF EXISTS "Customers can insert own orders" ON public.orders;

CREATE POLICY "Customers can insert own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = customer_id
  AND COALESCE(purchase_type, 'online') = 'online'
  AND walk_in_amount IS NULL
  AND staff_id IS NULL
  AND COALESCE(status, 'pending') = 'pending'
  AND COALESCE(payment_status, 'unpaid') = 'unpaid'
  AND picked_up_at IS NULL
);
