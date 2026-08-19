import type Anthropic from '@anthropic-ai/sdk';
import { ProjectDocumentFormat, type ProjectDocument } from '@prisma/client';

// Builds whatever content block Claude actually receives for a given
// ProjectDocument, fetching the file fresh each time rather than caching
// anything on the row. A TEXT format document is already a plain string.
// A FILE format PDF goes to Claude directly as a native document content
// block, no text or markdown extraction step in this codebase, see
// "Documents: sent directly to Claude" in docs/features/ai-integration/DESIGN.MD.
// Word, Excel, PowerPoint, and zip files have no equivalent Claude content
// block and are skipped, returning null, a known gap documented there.
export async function buildDocumentContent(
  document: ProjectDocument,
): Promise<Anthropic.ContentBlockParam | null> {
  if (document.format === ProjectDocumentFormat.TEXT) {
    return document.textContent
      ? { type: 'text', text: document.textContent }
      : null;
  }

  if (document.fileMimeType === 'application/pdf' && document.fileUrl) {
    const response = await fetch(document.fileUrl);
    const base64 = Buffer.from(await response.arrayBuffer()).toString('base64');
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      title: document.title,
    };
  }

  return null;
}
