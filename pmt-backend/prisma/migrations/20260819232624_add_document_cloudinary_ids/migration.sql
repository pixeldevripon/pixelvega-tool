-- Cloudinary's identifiers for a FILE document's asset.
--
-- Without them, removing a document left its bytes in Cloudinary permanently:
-- the stored url cannot be used to destroy an asset, and nothing else pointed
-- at it. resource_type is stored alongside because Cloudinary partitions its
-- namespace by it, so destroying a video as an 'image' succeeds and deletes
-- nothing.
--
-- Nullable, and left null for existing rows: those assets are already
-- unreachable, and inventing an id would be worse than admitting it.
ALTER TABLE "ProjectDocument" ADD COLUMN "filePublicId" TEXT;
ALTER TABLE "ProjectDocument" ADD COLUMN "fileResourceType" TEXT;
