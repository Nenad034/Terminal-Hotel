import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation pipe — class-validator na svim DTO-ovima
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger / OpenAPI dokumentacija
  const config = new DocumentBuilder()
    .setTitle('Terminal Hotel — PMS API')
    .setDescription(
      'Hotel Property Management System — Faza 1: PMS Jezgro\n\n' +
      'Svi endpointi zahtevaju `x-property-id` header za tenant kontekst, ' +
      'osim `/api/v1/organizations` i `/api/v1/auth` ruta.',
    )
    .setVersion('0.1.0')
    .addTag('Properties & Rooms', 'Upravljanje objektima i sobama')
    .addTag('Rates', 'Cenovnici i kalendar cena')
    .addTag('Guests', 'CRM — profili gostiju i GDPR')
    .addTag('Reservations', 'Rezervacioni engine — hold/confirm/check-in/out')
    .addTag('Folios', 'Folio i naplata — stavke i plaćanja')
    .addTag('Capacity', 'Kapacitet i zauzetost — real-time pregled')
    .addTag('Workers', 'Pozadinski radnici — TTL sweep i Night Audit')
    .addApiKey(
      { type: 'apiKey', name: 'x-property-id', in: 'header' },
      'property-context',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`🏨 Terminal Hotel PMS pokrenut na: http://localhost:${port}`);
  console.log(`📖 Swagger dokumentacija: http://localhost:${port}/api/docs`);
}

bootstrap();
