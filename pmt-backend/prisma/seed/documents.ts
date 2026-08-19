import type { PrismaClient } from '@prisma/client';
import { ProjectDocumentFormat, ProjectDocumentType } from '@prisma/client';
import { SEED_TODAY, VOLUME } from './config';
import { Rand, addDays } from './random';
import {
  CREDENTIAL_TEXTS,
  DOCUMENT_DESCRIPTIONS,
  DOCUMENT_TITLES,
  FILE_SAMPLES,
} from './pools';
import type { SeededProject } from './projects';
import type { SeededUsers } from './users';

const CLOUDINARY_BASE = 'https://res.cloudinary.com/demo';

// CREDENTIAL documents are typed straight into the app, so they are the TEXT
// format. Everything else is an uploaded file.
const TEXT_ONLY_TYPES: ProjectDocumentType[] = [ProjectDocumentType.CREDENTIAL];

const ALL_DOCUMENT_TYPES = Object.values(ProjectDocumentType);

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function seedDocuments(
  prisma: PrismaClient,
  rand: Rand,
  users: SeededUsers,
  projects: SeededProject[],
): Promise<number> {
  const rows: any[] = [];

  for (const project of projects) {
    // Only a PM on this project, or an admin, can add a document. Fall back to
    // an admin when the project has no active PM.
    const uploaders =
      project.managerIds.length > 0
        ? project.managerIds
        : users.adminSide.map((user) => user.id);

    const count = rand.intFrom(VOLUME.documentsPerProject);
    // A project usually has a PRD. The AI summary and scope checker both read
    // PRD and REQUIREMENT documents, so most projects need at least one.
    const types = [
      ProjectDocumentType.PRD,
      ...rand.sample(ALL_DOCUMENT_TYPES, count - 1),
    ];

    for (const type of types) {
      const titlePool = DOCUMENT_TITLES[type];
      const title = rand.pick(titlePool);

      // Documents are grouped into a revision history by type and title.
      // Uploading the same title again is a new row, not a replacement, so a
      // few groups get more than one revision to test that grouping.
      const revisions = rand.chance(0.25) ? rand.int(2, 3) : 1;

      for (let revision = 0; revision < revisions; revision++) {
        const createdAt = addDays(
          project.createdAt,
          rand.int(1, 40) + revision * rand.int(3, 15),
        );
        if (createdAt.getTime() > SEED_TODAY.getTime()) continue;

        const isText = TEXT_ONLY_TYPES.includes(type);
        const sample = rand.pick(FILE_SAMPLES);
        const publicId = `pmt/documents/${slug(project.name)}/${slug(title)}-${rand.hex(6)}`;

        rows.push({
          id: rand.uuid(),
          projectId: project.id,
          type,
          format: isText
            ? ProjectDocumentFormat.TEXT
            : ProjectDocumentFormat.FILE,
          title,
          description: rand.pick(DOCUMENT_DESCRIPTIONS),
          // A document is either typed text or an uploaded file, never both.
          textContent: isText ? rand.pick(CREDENTIAL_TEXTS) : null,
          fileUrl: isText
            ? null
            : `${CLOUDINARY_BASE}/${sample.mime.startsWith('image/') ? 'image' : 'raw'}/upload/v1/${publicId}.${sample.ext}`,
          fileMimeType: isText ? null : sample.mime,
          fileSizeBytes: isText ? null : rand.int(sample.min, sample.max),
          uploadedById: rand.pick(uploaders),
          createdAt,
          updatedAt: createdAt,
          // Soft delete, the same pattern as User. A few rows are removed so
          // the deletedAt filter has something to exclude.
          deletedAt: rand.chance(0.06)
            ? rand.dateBetween(createdAt, SEED_TODAY)
            : null,
        });
      }
    }
  }

  await prisma.projectDocument.createMany({ data: rows });
  return rows.length;
}
