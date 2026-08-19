/**
 * Asserts the generated OpenAPI document actually describes responses, not just
 * requests.
 *
 * Typing a response in a swagger file is only useful if it reaches
 * `/api/docs-json`, and that is easy to get wrong: a `type:` referencing a class
 * with no `@ApiProperty` fields produces an empty schema, and a decorator
 * composed but never applied produces nothing at all. This reads the real
 * document rather than the source.
 */

import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { createTestApp } from './create-test-app';

describe('OpenAPI document (e2e)', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await createTestApp();
    document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('PixelVega API').setVersion('1.0').build(),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents every route the app serves', () => {
    const operations = Object.values(document.paths).flatMap((item) =>
      Object.keys(item as object).filter((k) =>
        ['get', 'post', 'patch', 'put', 'delete'].includes(k),
      ),
    );
    expect(operations.length).toBeGreaterThanOrEqual(112);
  });

  it('gives every operation a summary', () => {
    const missing: string[] = [];
    for (const [path, item] of Object.entries(document.paths)) {
      for (const [method, op] of Object.entries(
        item as Record<string, { summary?: string }>,
      )) {
        if (!['get', 'post', 'patch', 'put', 'delete'].includes(method))
          continue;
        if (!op?.summary) missing.push(`${method.toUpperCase()} ${path}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('registers the error response schemas', () => {
    const schemas = Object.keys(document.components?.schemas ?? {});
    expect(schemas).toEqual(
      expect.arrayContaining([
        'BadRequestErrorDto',
        'UnauthorizedErrorDto',
        'ForbiddenErrorDto',
        'NotFoundErrorDto',
        'ConflictErrorDto',
        'InternalServerErrorDto',
      ]),
    );
  });

  describe('response schemas, not only request schemas', () => {
    it('registers the project response DTOs with real fields', () => {
      const schemas = document.components?.schemas ?? {};
      expect(Object.keys(schemas)).toEqual(
        expect.arrayContaining([
          'ProjectResponseDto',
          'ClientProjectResponseDto',
        ]),
      );
      const project = schemas.ProjectResponseDto as { properties?: object };
      expect(Object.keys(project.properties ?? {}).length).toBeGreaterThan(10);
    });

    it('keeps every internal field OFF the client projection', () => {
      // The security boundary, asserted against the generated document rather
      // than against the source. If someone adds priority to the client DTO,
      // this fails.
      const client = document.components?.schemas?.ClientProjectResponseDto as {
        properties?: Record<string, unknown>;
      };
      const fields = Object.keys(client.properties ?? {});
      for (const internal of [
        'priority',
        'rushReason',
        'onHoldReason',
        'cancellationReason',
        'createdBy',
        'estimatedHours',
        'actualHours',
        'remainingHours',
        'archivedAt',
        'slackChannelId',
      ]) {
        expect(fields).not.toContain(internal);
      }
    });

    it('types the 200 on GET /api/projects/{id}', () => {
      const op = document.paths['/api/projects/{id}']?.get as {
        responses?: Record<string, { content?: object }>;
      };
      expect(op?.responses?.['200']?.content).toBeDefined();
    });
  });
});
