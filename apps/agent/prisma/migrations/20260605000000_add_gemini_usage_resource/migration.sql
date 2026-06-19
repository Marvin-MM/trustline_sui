DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'GEMINI_TOKENS'
      AND enumtypid = '"ResourceType"'::regtype
  ) THEN
    ALTER TYPE "ResourceType" ADD VALUE 'GEMINI_TOKENS';
  END IF;
END $$;
