import { ProjectType } from '@prisma/client';

const SLACK_CHANNEL_NAME_MAX_LENGTH = 80;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildChannelName(
  projectTypes: ProjectType[],
  projectName: string,
): string {
  const typeSlugs = [...projectTypes].sort().map(slugify);
  const parts = [...typeSlugs, slugify(projectName)].filter(Boolean);

  return parts
    .join('-')
    .slice(0, SLACK_CHANNEL_NAME_MAX_LENGTH)
    .replace(/-+$/, '');
}
