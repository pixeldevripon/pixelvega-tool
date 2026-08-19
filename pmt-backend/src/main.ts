import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '@/app.module';
import { addBetterAuthPaths } from '@/common/swagger/better-auth-paths';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // required by @thallesp/nestjs-better-auth
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('PixelVega API')
    .setDescription(
      'API reference for the PixelVega backend. Session-protected routes require the ' +
        'better-auth.session_token cookie set by /api/auth/sign-in/email — sign in there first, ' +
        'then the cookie is sent automatically on subsequent requests from a browser.',
    )
    .setVersion('1.0')
    .addCookieAuth('better-auth.session_token')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  addBetterAuthPaths(document);
  SwaggerModule.setup('api/docs', app, document);

  //cors
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
