import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../modules/audit/audit.service';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * AuditLogInterceptor — globalno hvata sve uspešne mutacije (POST/PATCH/PUT/
 * DELETE) i upisuje audit_event red preko AuditService (pogl. 22). Radi
 * generički preko svih kontrolera bez potrebe da svaki servis eksplicitno
 * poziva audit — cena te opštosti: beforeState se ne hvata (zahtevalo bi
 * domensko znanje o resursu pre mutacije), pa ostaje null; upis takođe NIJE
 * u istoj DB transakciji kao poslovna mutacija (izvršava se posle uspešnog
 * odgovora). Servisi koji žele pravi before/after u istoj transakciji mogu
 * pozvati AuditService.record() direktno (vidi AuthService.login).
 *
 * Preskače: GET/HEAD zahteve, rute bez propertyId (bootstrap organizacija/
 * login) i rute bez ulogovanog zaposlenog (JWT guard ih već propušta samo
 * ako su @Public()).
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method: string = request.method;

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const propertyId: string | undefined = request.propertyId;
    const employee = request.employee;

    if (!propertyId || !employee) {
      return next.handle();
    }

    const controllerName = context.getClass().name.replace(/Controller$/, '');
    const handlerName = context.getHandler().name;
    const action = `${controllerName}.${handlerName}`;

    return next.handle().pipe(
      tap((response) => {
        this.writeAuditEvent(propertyId, employee.sub, action, controllerName, request, response).catch(() => undefined);
      }),
    );
  }

  private async writeAuditEvent(
    propertyId: string,
    actorEmployeeId: string,
    action: string,
    resourceType: string,
    request: any,
    response: unknown,
  ) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { organizationId: true },
    });
    if (!property) return;

    await this.auditService.record({
      organizationId: property.organizationId,
      propertyId,
      actorEmployeeId,
      actorType: 'employee',
      action,
      resourceType,
      resourceId: request.params?.id ?? (response as any)?.id ?? null,
      afterState: response,
      metadata: { method: request.method, path: request.originalUrl ?? request.url },
    });
  }
}
