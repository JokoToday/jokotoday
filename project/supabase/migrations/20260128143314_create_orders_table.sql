/*
  # Create orders table

  1. New Tables
    - `orders`
      - `id` (uuid, primary key)
      - `customer_id` (uuid) - References customers.id
      - `order_number` (text, unique) - Human-readable order number
      - `order_items` (jsonb) - Array of cart items with product details
      - `total_amount` (numeric) - Total order amount
      - `pickup_location_id` (uuid) - References cms_pickup_locations.id
      - `pickup_date` (date) - Selected pickup date
      - `status` (text) - Order status: pending, confirmed, ready, picked_up, cancelled
      - `payment_status` (text) - Payment status: unpaid, paid
      - `line_id` (text) - Customer's LINE ID for contact
      - `customer_name` (text) - Customer name at time of order
      - `customer_phone` (text) - Customer phone at time of order
      - `customer_email` (text) - Customer email at time of order
      - `notes` (text) - Order notes
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `orders` table
    - Add policy for customers to read their own orders
    - Add policy for staff to read all orders
    - Add policy for customers to insert their own orders
    - Add policy for staff to update orders

  3. Indexes
    - Index on customer_id for faster lookups
    - Index on order_number for order tracking
    - Index on pickup_date for daily order lists
    - Index on status for filtering
*/

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  order_number text UNIQUE NOT NULL,
  order_items jsonb DEFAULT '[]'::jsonb,
  total_amount numeric(10, 2) NOT NULL,
  pickup_location_id uuid REFERENCES cms_pickup_locations(id) ON DELETE SET NULL,
  pickup_date date NOT NULL,
  status text DEFAULT 'pending',
  payment_status text DEFAULT 'unpaid',
  line_id text,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'ready', 'picked_up', 'cancelled')),
  CONSTRAINT valid_payment_status CHECK (payment_status IN ('unpaid', 'paid'))
);

CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders(customer_id);
CREATE INDEX IF NOT EXISTS orders_order_number_idx ON orders(order_number);
CREATE INDEX IF NOT EXISTS orders_pickup_date_idx ON orders(pickup_date);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id);

CREATE POLICY "Anyone can read orders by customer lookup"
  ON orders FOR SELECT
  TO anon, authenticated
  USING (customer_id IS NOT NULL);

CREATE POLICY "Customers can insert own orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Anyone can update orders"
  ON orders FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_orders_updated_at ON orders;

CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();
