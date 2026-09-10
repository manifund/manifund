-- Add Mercury recipient ID to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mercury_recipient_id TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN public.profiles.mercury_recipient_id IS 'Mercury API recipient ID for bank payouts';