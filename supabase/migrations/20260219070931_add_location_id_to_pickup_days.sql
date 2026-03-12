/*
  # Add location_id to cms_pickup_days

  Links each pickup day to its corresponding pickup location.

  1. Changes
    - Add `location_id` (uuid, FK to cms_pickup_locations) to `cms_pickup_days`
    - Populate based on day_key pattern (_maerim → Mae Rim, _intown → In-Town)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_pickup_days' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE cms_pickup_days ADD COLUMN location_id uuid REFERENCES cms_pickup_locations(id);
  END IF;
END $$;

UPDATE cms_pickup_days
SET location_id = '80888caa-c215-47e9-87a1-308b27e8fde5'
WHERE day_key LIKE '%maerim%';

UPDATE cms_pickup_days
SET location_id = '1260c8a0-d8e6-4877-8bf9-e2942477a40e'
WHERE day_key LIKE '%intown%';
