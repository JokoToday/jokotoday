/*
  # Add Bilingual Labels to Pickup Days

  1. Modified Tables
    - `cms_pickup_days` - Add label_en and label_th for bilingual support
  2. Data Changes
    - Migrate existing English labels to label_en
    - Add Thai translations to label_th
  3. Notes
    - Both English and Thai labels are now supported
    - The label column can be deprecated after UI migration is complete
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_pickup_days' AND column_name = 'label_en'
  ) THEN
    ALTER TABLE cms_pickup_days ADD COLUMN label_en text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_pickup_days' AND column_name = 'label_th'
  ) THEN
    ALTER TABLE cms_pickup_days ADD COLUMN label_th text;
  END IF;
END $$;

UPDATE cms_pickup_days
SET label_en = CASE 
  WHEN day_key = 'friday_maerim' THEN 'Friday – Mae Rim'
  WHEN day_key = 'saturday_maerim' THEN 'Saturday – Mae Rim'
  WHEN day_key = 'sunday_intown' THEN 'Sunday – In-Town'
  ELSE label
END,
label_th = CASE 
  WHEN day_key = 'friday_maerim' THEN 'วันศุกร์ – แม่ริม'
  WHEN day_key = 'saturday_maerim' THEN 'วันเสาร์ – แม่ริม'
  WHEN day_key = 'sunday_intown' THEN 'วันอาทิตย์ – ในเมือง'
  ELSE label
END
WHERE day_key IN ('friday_maerim', 'saturday_maerim', 'sunday_intown');
