/*
  # Add customer role and fix missing user profiles

  1. Changes
    - Adds 'customer' value to the user_role enum
    - Updates default role for user_profiles to 'customer'
    - Inserts missing profile row for jokotoday@gmail.com

  2. Notes
    - The user_role enum previously only had admin and staff
    - New signups via magic link need a customer role
    - The jokotoday account was confirmed but had no profile row
*/

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'customer';
