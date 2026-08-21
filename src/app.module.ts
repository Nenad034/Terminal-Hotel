import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { PropertiesModule } from './modules/properties/properties.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { RatesModule } from './modules/rates/rates.module';
import { GuestsModule } from './modules/guests/guests.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { FoliosModule } from './modules/folios/folios.module';
import { CapacityModule } from './modules/capacity/capacity.module';
import { WorkersModule } from './modules/workers/workers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    PropertiesModule,
    RoomsModule,
    RatesModule,
    GuestsModule,
    ReservationsModule,
    FoliosModule,
    CapacityModule,
    WorkersModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Tenant middleware na svim rutama osim organizations (koji nema property kontekst)
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'api/v1/organizations', method: RequestMethod.ALL },
        { path: 'api/v1/organizations/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes('*');
  }
}
