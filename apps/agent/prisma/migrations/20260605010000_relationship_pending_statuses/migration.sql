DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'PENDING_ON_CHAIN'
      AND enumtypid = '"RelationshipStatus"'::regtype
  ) THEN
    ALTER TYPE "RelationshipStatus" ADD VALUE 'PENDING_ON_CHAIN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'FAILED_ON_CHAIN'
      AND enumtypid = '"RelationshipStatus"'::regtype
  ) THEN
    ALTER TYPE "RelationshipStatus" ADD VALUE 'FAILED_ON_CHAIN';
  END IF;
END $$;
