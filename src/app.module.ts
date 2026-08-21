import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuthModule } from './modules/auth/auth.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { RatesModule } from './modules/rates/rates.module';
import { GuestsModule } from './modules/guests/guests.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { FoliosModule } from './modules/folios/folios.module';
import { CapacityModule } from './modules/capacity/capacity.module';
import { WorkersModule } from './modules/workers/workers.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { DiningModule } from './modules/dining/dining.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    PropertiesModule,
    RoomsModule,
    RatesModule,
    GuestsModule,
    ReservationsModule,
    FoliosModule,
    CapacityModule,
    WorkersModule,
    TasksModule,
    DiningModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Tenant middleware na svim rutama osim organizations (bez property konteksta)
    // i auth/login (property se šalje u telu zahteva, ne kroz header, jer se pre
    // prijave ne zna da li klijent uopšte ima važeći kontekst objekta).
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'organizations', method: RequestMethod.ALL },
        { path: 'organizations/(.*)', method: RequestMethod.ALL },
        { path: 'auth/login', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
