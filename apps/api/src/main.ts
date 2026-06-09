import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { loadSecurityConfig } from './config/security.config';
import { AppModule } from './modules/app.module';

async function bootstrap(): Promise<void> {
  // Fail closed: this throws before the server starts if security config is missing.
  const security = loadSecurityConfig();

  const app = await NestFactory.create(AppModule);

  // Security headers (HSTS, no-sniff, frameguard, etc.).
  app.use(helmet());

  // Explicit CORS allowlist. No allowlist means no cross-origin access.
  app.enableCors({
    origin: security.cors.origins.length > 0 ? security.cors.origins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Correlation-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  const swaggerEnabled =
    process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true';

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('AURION API')
      .setDescription('Voice Agent SaaS Core API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}

void bootstrap();
