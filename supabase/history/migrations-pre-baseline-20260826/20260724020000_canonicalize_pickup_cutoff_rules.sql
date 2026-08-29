/*
  Make pickup_cutoff_rules the authoritative cutoff source.

  cms_pickup_days retains the stable pickup identity, weekday, location,
  enabled state, and display content. Its legacy cutoff columns are synchronized
  for compatibility, but application cutoff calculations no longer read them.
*/

ALTER TABLE cms_pickup_days
  ADD COLUMN IF NOT EXISTS pickup_weekday smallint;

UPDATE cms_pickup_days
SET pickup_weekday = CASE day_key
  WHEN 'friday_maerim' THEN 5
  WHEN 'saturday_maerim' THEN 6
  WHEN 'sunday_intown' THEN 0
END
WHERE day_key IN ('friday_maerim', 'saturday_maerim', 'sunday_intown');

ALTER TABLE cms_pickup_days
  ALTER COLUMN pickup_weekday SET NOT NULL;

ALTER TABLE cms_pickup_days
  DROP CONSTRAINT IF EXISTS cms_pickup_days_pickup_weekday_check;

ALTER TABLE cms_pickup_days
  ADD CONSTRAINT cms_pickup_days_pickup_weekday_check
  CHECK (pickup_weekday BETWEEN 0 AND 6);

ALTER TABLE pickup_cutoff_rules
  ADD COLUMN IF NOT EXISTS day_key text;

UPDATE pickup_cutoff_rules
SET day_key = CASE
  WHEN pickup_day = 'Friday' AND location = 'Mae Rim' THEN 'friday_maerim'
  WHEN pickup_day = 'Saturday' AND location = 'Mae Rim' THEN 'saturday_maerim'
  WHEN pickup_day = 'Sunday' AND location = 'In-Town' THEN 'sunday_intown'
END
WHERE day_key IS NULL;

ALTER TABLE pickup_cutoff_rules
  ALTER COLUMN day_key SET NOT NULL;

ALTER TABLE pickup_cutoff_rules
  DROP CONSTRAINT IF EXISTS pickup_cutoff_rules_day_key_fkey;

ALTER TABLE pickup_cutoff_rules
  ADD CONSTRAINT pickup_cutoff_rules_day_key_fkey
  FOREIGN KEY (day_key) REFERENCES cms_pickup_days(day_key);

CREATE UNIQUE INDEX IF NOT EXISTS pickup_cutoff_rules_day_key_idx
  ON pickup_cutoff_rules(day_key);

UPDATE pickup_cutoff_rules
SET
  cutoff_day = CASE day_key
    WHEN 'friday_maerim' THEN 'Wednesday'
    WHEN 'saturday_maerim' THEN 'Thursday'
    WHEN 'sunday_intown' THEN 'Friday'
  END,
  cutoff_time = '17:00',
  updated_at = now()
WHERE day_key IN ('friday_maerim', 'saturday_maerim', 'sunday_intown');

UPDATE cms_pickup_days AS pickup_day
SET
  cutoff_day = cutoff_rule.cutoff_day,
  cutoff_time = cutoff_rule.cutoff_time,
  updated_at = now()
FROM pickup_cutoff_rules AS cutoff_rule
WHERE cutoff_rule.day_key = pickup_day.day_key;

COMMENT ON COLUMN cms_pickup_days.cutoff_day IS
  'Deprecated compatibility mirror; pickup_cutoff_rules is authoritative.';

COMMENT ON COLUMN cms_pickup_days.cutoff_time IS
  'Deprecated compatibility mirror; pickup_cutoff_rules is authoritative.';
