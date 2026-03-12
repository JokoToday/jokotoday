/*
  # Update Pickup Days with Cutoff Day Configuration

  1. Modified Tables
    - `cms_pickup_days` - Add cutoff_day field for day-based cutoff logic
  2. Data Changes
    - Update existing pickup days with cutoff day values
  3. Notes
    - cutoff_day format: "Monday", "Tuesday", "Wednesday", etc.
    - Combines with cutoff_time (e.g., "17:00") for full cutoff datetime
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_pickup_days' AND column_name = 'cutoff_day'
  ) THEN
    ALTER TABLE cms_pickup_days ADD COLUMN cutoff_day text NOT NULL DEFAULT 'Monday';
  END IF;
END $$;

UPDATE cms_pickup_days
SET cutoff_day = CASE 
  WHEN day_key = 'friday_maerim' THEN 'Wednesday'
  WHEN day_key = 'saturday_maerim' THEN 'Thursday'
  WHEN day_key = 'sunday_intown' THEN 'Friday'
  ELSE cutoff_day
END
WHERE day_key IN ('friday_maerim', 'saturday_maerim', 'sunday_intown');
