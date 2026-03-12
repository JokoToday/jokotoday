/*
  # Add Chinese (zh) fields for pickup days and cutoff rules

  ## Changes

  1. cms_pickup_days
     - Add label_zh column (already had label_en, label_th)
     - Fill Friday, Saturday, Sunday labels in Chinese

  2. pickup_cutoff_rules
     - Already has pickup_label_zh (filled by previous migration)
     - Add cutoff_day_zh column to translate "Order by Wednesday 17:00"
     - Fill Chinese day names for cutoff_day_zh
*/

-- 1. Add label_zh to cms_pickup_days if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cms_pickup_days' AND column_name = 'label_zh'
  ) THEN
    ALTER TABLE cms_pickup_days ADD COLUMN label_zh text;
  END IF;
END $$;

-- Fill cms_pickup_days label_zh
UPDATE cms_pickup_days SET label_zh = '周五 – 湄林' WHERE day_key = 'friday_maerim';
UPDATE cms_pickup_days SET label_zh = '周六 – 湄林' WHERE day_key = 'saturday_maerim';
UPDATE cms_pickup_days SET label_zh = '周日 – 市区' WHERE day_key = 'sunday_intown';

-- 2. Add cutoff_day_zh to pickup_cutoff_rules if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pickup_cutoff_rules' AND column_name = 'cutoff_day_zh'
  ) THEN
    ALTER TABLE pickup_cutoff_rules ADD COLUMN cutoff_day_zh text;
  END IF;
END $$;

-- Fill cutoff_day_zh (maps English day names to Chinese)
UPDATE pickup_cutoff_rules SET cutoff_day_zh = '周三' WHERE cutoff_day = 'Wednesday';
UPDATE pickup_cutoff_rules SET cutoff_day_zh = '周四' WHERE cutoff_day = 'Thursday';
UPDATE pickup_cutoff_rules SET cutoff_day_zh = '周五' WHERE cutoff_day = 'Friday';
UPDATE pickup_cutoff_rules SET cutoff_day_zh = '周六' WHERE cutoff_day = 'Saturday';
UPDATE pickup_cutoff_rules SET cutoff_day_zh = '周日' WHERE cutoff_day = 'Sunday';
UPDATE pickup_cutoff_rules SET cutoff_day_zh = '周一' WHERE cutoff_day = 'Monday';
UPDATE pickup_cutoff_rules SET cutoff_day_zh = '周二' WHERE cutoff_day = 'Tuesday';
