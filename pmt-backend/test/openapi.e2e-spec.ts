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
import { mergeBetterAuthSchema } from '@/common/swagger/better-auth-schema';
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
    // main.ts does this too, and skipping it here is how the auth half of the
    // document went unasserted while it silently listed three routes of thirty.
    await mergeBetterAuthSchema(document);
  });

  afterAll(async () => {
    await app.close();
  });

  const operationsIn = (paths: OpenAPIObject['paths']) =>
    Object.values(paths).flatMap((item) =>
      Object.keys(item as object).filter((k) =>
        ['get', 'post', 'patch', 'put', 'delete'].includes(k),
      ),
    );

  it("documents every route the app's own controllers serve", () => {
    const own = Object.fromEntries(
      Object.entries(document.paths).filter(
        ([path]) => !path.startsWith('/api/auth'),
      ),
    );
    expect(operationsIn(own).length).toBeGreaterThanOrEqual(108);
  });

  it('documents the auth routes better-auth serves', () => {
    // AuthController is one catch-all, so reflection can only see
    // `ALL /api/auth/*splat`. These entries come from better-auth's own
    // generated schema, merged in above.
    const authPaths = Object.keys(document.paths).filter((path) =>
      path.startsWith('/api/auth/'),
    );
    expect(authPaths).toEqual(
      expect.arrayContaining([
        '/api/auth/sign-in/email',
        '/api/auth/sign-out',
        '/api/auth/get-session',
        '/api/auth/request-password-reset',
        '/api/auth/reset-password',
        '/api/auth/change-password',
      ]),
    );
  });

  it('leaves the catch-all itself out of the document', () => {
    // A single `ALL /api/auth/*splat` entry documents nothing and would sit in
    // the list looking like a real endpoint. @ApiExcludeController() hides it.
    expect(Object.keys(document.paths)).not.toContain('/api/auth/{splat}');
    expect(Object.keys(document.paths)).not.toContain('/api/auth/*splat');
  });

  it('gives every operation a summary', () => {
    const missing: string[] = [];
    for (const [path, item] of Object.entries(document.paths)) {
      // better-auth generates its own operations with a description rather than
      // a summary. They are the library's text, not ours to decorate.
      if (path.startsWith('/api/auth')) continue;
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

    it('types the 200 on GET /api/projects/{projectId}', () => {
      const op = document.paths['/api/projects/{projectId}']?.get as {
        responses?: Record<string, { content?: object }>;
      };
      expect(op?.responses?.['200']?.content).toBeDefined();
    });

    /**
     * The contract check (phase 6). Every success response must carry a schema,
     * not merely a description.
     *
     * This is what stops the API drifting back into "documents what goes in but
     * not what comes back". A hand written frontend type can only be checked
     * against a document that actually describes the response, and a reviewer
     * can only spot a breaking change in a field they can see.
     */
    it('gives EVERY success response a schema, not just a description', () => {
      const untyped: string[] = [];
      for (const [path, item] of Object.entries(document.paths)) {
        for (const [method, op] of Object.entries(
          item as Record<
            string,
            { responses?: Record<string, { content?: object }> }
          >,
        )) {
          if (!['get', 'post', 'patch', 'put', 'delete'].includes(method)) {
            continue;
          }
          for (const [status, response] of Object.entries(
            op?.responses ?? {},
          )) {
            if (!status.startsWith('2')) continue;
            // 204 has no body by definition, and the better-auth routes are
            // mounted by the library rather than declared here.
            if (status === '204') continue;
            if (path.startsWith('/api/auth')) continue;
            if (!response?.content) {
              untyped.push(`${method.toUpperCase()} ${path} -> ${status}`);
            }
          }
        }
      }
      expect(untyped).toEqual([]);
    });

    it('resolves every enum field to the shared display object', () => {
      // ADR 0001 is only true if it reaches the document: a status typed as a
      // bare string here means some response still hands a client a raw enum.
      const schemas = document.components?.schemas ?? {};
      expect(Object.keys(schemas)).toContain('EnumDisplayDto');

      const display = schemas.EnumDisplayDto as {
        properties?: Record<string, { enum?: string[] }>;
      };
      expect(Object.keys(display.properties ?? {}).sort()).toEqual([
        'label',
        'tone',
        'value',
      ]);
      // The tone vocabulary is closed, and the document is where a client
      // learns that.
      expect(display.properties?.tone?.enum).toEqual([
        'default',
        'primary',
        'success',
        'warning',
        'danger',
      ]);
    });

    it('types the status on a project as the display object, not a string', () => {
      const project = document.components?.schemas?.ProjectResponseDto as {
        properties?: Record<string, { $ref?: string; allOf?: unknown }>;
      };
      const status = project.properties?.status;
      expect(JSON.stringify(status)).toContain('EnumDisplayDto');
    });

    it('publishes the capability flags a client gates its UI from', () => {
      const schemas = document.components?.schemas ?? {};
      expect(Object.keys(schemas)).toContain('ProjectCapabilitiesDto');
      const caps = schemas.ProjectCapabilitiesDto as {
        properties?: Record<string, unknown>;
      };
      expect(Object.keys(caps.properties ?? {})).toEqual(
        expect.arrayContaining([
          'canEdit',
          'canChangeStatus',
          'canArchive',
          'canRestore',
        ]),
      );
    });
  });
});
