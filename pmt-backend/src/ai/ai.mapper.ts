import { AiJob, AiJobStatus, AiTemplate } from '@prisma/client';

import {
  AI_JOB_STATUS_DISPLAY,
  AI_JOB_TYPE_DISPLAY,
  AI_TEMPLATE_KIND_DISPLAY,
  toEnumDisplay,
} from '@/common/utils/enum-display.util';

import { AiJobResponseDto, AiTemplateResponseDto } from './dto/ai.dto';

/** A job has finished when there is nothing more to wait for. */
const TERMINAL_STATUSES: AiJobStatus[] = [
  AiJobStatus.COMPLETED,
  AiJobStatus.FAILED,
];

export function toAiTemplateResponse(
  template: AiTemplate,
): AiTemplateResponseDto {
  return {
    id: template.id,
    kind: toEnumDisplay(AI_TEMPLATE_KIND_DISPLAY, template.kind),
    name: template.name,
    content: template.content,
    isDefault: template.isDefault,
    createdById: template.createdById,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

export function toAiJobResponse(job: AiJob): AiJobResponseDto {
  return {
    id: job.id,
    type: toEnumDisplay(AI_JOB_TYPE_DISPLAY, job.type),
    status: toEnumDisplay(AI_JOB_STATUS_DISPLAY, job.status),
    projectId: job.projectId,
    requestedById: job.requestedById,
    input: job.input,
    resultRefId: job.resultRefId,
    errorMessage: job.errorMessage,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    // What a polling client stops on. Deriving it from a status comparison in
    // the client would mean the client deciding what "finished" means, and a
    // new terminal status would then silently poll forever.
    isFinished: TERMINAL_STATUSES.includes(job.status),
    createdAt: job.createdAt,
  };
}
