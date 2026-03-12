/*
  # Add completed status to orders

  1. Change
    - Add 'completed' status to valid_status constraint
    - This status is used for walk-in purchases that are immediately paid

  2. Valid statuses
    - pending: Not yet confirmed
    - confirmed: Confirmed by customer
    - ready: Ready for pickup
    - picked_up: Completed pickup
    - completed: Completed walk-in purchase (paid immediately)
    - cancelled: Order cancelled
*/

ALTER TABLE orders DROP CONSTRAINT valid_status;

ALTER TABLE orders ADD CONSTRAINT valid_status CHECK (
  status IN ('pending', 'confirmed', 'ready', 'picked_up', 'completed', 'cancelled')
);
