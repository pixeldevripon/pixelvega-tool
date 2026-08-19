import 'dotenv/config';

import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from '@/app.module';
import { AllExceptionsFilter } from '@/common/filters/http-exception.filter';
import { parseCorsOrigins } from '@/common/utils/parse-cors-origins.util';
import { addBetterAuthPaths } from '@/common/swagger/better-auth-paths';
import { validateEnv } from '@/env.validate';

async function bootstrap() {
  // First statement on purpose: a missing or placeholder value should stop the
  // process here, with a named error, rather than surfacing later inside
  // whichever feature happened to read it first.
  validateEnv();

  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // required by @thallesp/nestjs-better-auth, which parses the body itself
  });
  const isProduction = process.env.NODE_ENV === 'production';

  // Trust one proxy hop (nginx, Cloudflare) so ThrottlerGuard rate limits by
  // the real client IP from X-Forwarded-For rather than by the load balancer,
  // which would otherwise share one bucket across every user.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // unsafe-inline is needed by Swagger UI only, so it is dropped in
          // production where /api/docs is not the primary surface.
          scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'"],
          styleSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  // ── CORS ──────────────────────────────────────────────────────────────────
  // An allowlist that fails closed. The previous wildcard fallback could never
  // have worked: this API sends credentials, and browsers reject '*' with
  // credentials, so a missing env var broke every authenticated call in a
  // confusing way instead of failing loudly at boot. env.validate.ts now
  // rejects a wildcard outright.
  const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      // No Origin header at all means a non browser caller (curl, Postman,
      // server to server), which CORS does not govern. The literal string
      // 'null' is NOT allowed: that is what a sandboxed iframe or a file://
      // page sends, and combined with credentials it would let such a page
      // make cookie carrying calls.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // An HttpException rather than a plain Error: the request is still
        // blocked before any handler, but the filter answers a clean 403
        // instead of logging a 500 and a stack trace for every scanner.
        callback(new ForbiddenException('CORS: origin not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    // Cache the preflight. Every browser call here carries
    // Content-Type: application/json, so each one is non-simple and would
    // otherwise pay a second round trip.
    maxAge: 86_400,
  });

  // ── Global pipes and filters ──────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // A body field that is not on the DTO is now a 400 rather than being
      // silently dropped. Silent stripping made a mistyped field name fail
      // quiet: the request succeeded and the value was simply never applied.
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  // ── Swagger ───────────────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('PixelVega API')
    .setDescription(
      'API reference for the PixelVega backend. Session protected routes require the ' +
        'better-auth.session_token cookie set by /api/auth/sign-in/email. Sign in there first, ' +
        'then the cookie is sent automatically on subsequent requests from a browser.',
    )
    .setVersion('1.0')
    .addCookieAuth('better-auth.session_token')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  addBetterAuthPaths(document);
  SwaggerModule.setup('api/docs', app, document);

  // Let Nest run onModuleDestroy hooks (Prisma disconnect, queue drain) on
  // SIGTERM rather than dropping connections.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
