import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { bodyParsersExceptAuth } from '../src/common/middleware/body-parsers.middleware';
import { AUTH_BASE_PATH } from '../src/auth/instance/auth.instance';

/**
 * Boots the real AppModule configured EXACTLY as src/main.ts configures it.
 *
 * Every E2E spec goes through this factory rather than calling
 * createNestApplication() itself. The reason is the classic E2E failure mode:
 * a suite that configures its own pipeline drifts from production, so the tests
 * pass while the deployed app rejects the same request. Keeping the setup in
 * one place means the drift can only happen once, and it is visible here.
 *
 * KEEP THIS IN STEP WITH src/main.ts. When a global pipe, filter, interceptor,
 * or prefix is added there, add it here in the same commit. The two are
 * deliberately duplicated rather than shared, matching the reference backend's
 * layout, so this comment is the only thing holding them together.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // bodyParser: false plus `bodyParsersExceptAuth` mirrors main.ts. Nest's
  // parser must not consume the request stream on /api/auth.
  const app = moduleFixture.createNestApplication({ bodyParser: false });

  app.use(bodyParsersExceptAuth(AUTH_BASE_PATH));

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');

  await app.init();
  return app;
}
