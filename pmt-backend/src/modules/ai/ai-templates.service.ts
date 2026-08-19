import { Injectable, NotFoundException } from '@nestjs/common';
import { AiTemplate, AiTemplateKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAiTemplateDto } from './dto/create-ai-template.dto';
import { UpdateAiTemplateDto } from './dto/update-ai-template.dto';
import { QueryAiTemplatesDto } from './dto/query-ai-templates.dto';

// Reference data, read everyone (any staff role), write Admin/System Admin
// only, the same pattern LeaveType/Holiday already use. content is a
// structural outline, not the generated output itself, ProjectSummaryService
// and the status report job (Phase 3/5) read whichever row is isDefault for
// their kind and drop its content straight into the system prompt.
@Injectable()
export class AiTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: QueryAiTemplatesDto): Promise<AiTemplate[]> {
    return this.prisma.aiTemplate.findMany({
      where: query.kind ? { kind: query.kind } : undefined,
      orderBy: { createdAt: 'asc' },
    });
  }

  // Read by ProjectAiSummaryService (Phase 4) and, later, the status report
  // job (Phase 5), each dropping this row's content straight into the
  // system prompt for their Claude call. Returns null rather than throwing
  // when a kind currently has no default, e.g. right after someone deletes
  // it, see the note on remove() below.
  findDefault(kind: AiTemplateKind): Promise<AiTemplate | null> {
    return this.prisma.aiTemplate.findFirst({
      where: { kind, isDefault: true },
    });
  }

  async create(dto: CreateAiTemplateDto, actorId: string): Promise<AiTemplate> {
    if (dto.isDefault) {
      return this.prisma.$transaction(async (tx) => {
        await tx.aiTemplate.updateMany({
          where: { kind: dto.kind, isDefault: true },
          data: { isDefault: false },
        });
        return tx.aiTemplate.create({
          data: {
            kind: dto.kind,
            name: dto.name,
            content: dto.content,
            isDefault: true,
            createdById: actorId,
          },
        });
      });
    }
    return this.prisma.aiTemplate.create({
      data: {
        kind: dto.kind,
        name: dto.name,
        content: dto.content,
        isDefault: false,
        createdById: actorId,
      },
    });
  }

  async update(id: string, dto: UpdateAiTemplateDto): Promise<AiTemplate> {
    const template = await this.getOrThrow(id);

    if (dto.isDefault) {
      return this.prisma.$transaction(async (tx) => {
        await tx.aiTemplate.updateMany({
          where: { kind: template.kind, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
        return tx.aiTemplate.update({
          where: { id },
          data: {
            name: dto.name,
            content: dto.content,
            isDefault: true,
          },
        });
      });
    }

    return this.prisma.aiTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        content: dto.content,
        ...(dto.isDefault === false && { isDefault: false }),
      },
    });
  }

  // Hard delete, this model has no deletedAt field, unlike BlockerReason.
  // Deleting the current default of a kind is allowed, not guarded against,
  // that leaves the kind with no default until a new one is created, a real
  // gap worth knowing about rather than a reason to add a check nobody asked
  // for yet.
  async remove(id: string): Promise<AiTemplate> {
    await this.getOrThrow(id);
    return this.prisma.aiTemplate.delete({ where: { id } });
  }

  private async getOrThrow(id: string): Promise<AiTemplate> {
    const template = await this.prisma.aiTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }
}
