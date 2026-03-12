/*
  # Drop at_least_one_contact_method constraint from user_profiles

  1. Problem
    - The constraint requires line_id, whatsapp, or wechat_id to be set
    - This blocks new user profile creation during magic link sign-in
    - Users signing up via email have none of these contact methods yet

  2. Change
    - Drops the constraint to allow profile creation without social contact info
    - Users can add contact methods later in their profile settings
*/

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS at_least_one_contact_method;
