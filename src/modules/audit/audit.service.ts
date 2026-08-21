import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';

export interface RecordAuditEventInput {
  organizationId: string;
  propertyId?: string | null;
  actorEmployeeId?: string | null;
  actorType?: 'employee' | 'system' | 'api_key';
  action: string;
  resourceType: string;
  resourceId?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  metadata?: Record<string, unknown>;
}

// GDPR (pogl. 22): PII ne ide direktno u append-only log — samo referenca po
// ID-ju. Rekurzivno uklanja poznata PII polja iz snimljenog stanja pre upisa.
const PII_KEYS = new Set([
  'firstName', 'lastName', 'email', 'phone', 'passwordHash',
  'idDocumentNumber', 'idDocumentType', 'nationality', 'address',
  'documentReference', 'paymentToken',
]);

// JSONB u Postgres-u ne čuva redosled ključeva objekta, pa običan
// JSON.stringify daje drugačiji string pri ponovnom čitanju iz baze nego pri
// upisu — hash bi se "polomio" iako se sadržaj nije promenio. Stabilan
// stringify (rekurzivno sortirani ključevi) čini hash nezavisnim od redosleda.
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function redactPii(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redactPii(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = PII_KEYS.has(k) ? '[redacted]' : redactPii(v, depth + 1);
    }
    return out;
  }
  return value;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upisuje audit_event red sa hash-lancem (tamper-evidence, pogl. 22).
   * Best-effort — greška u audit upisu ne sme oboriti poslovnu operaciju koja
   * ga je pokrenula, pa se ovde hvata i samo loguje.
   */
  async record(input: RecordAuditEventInput): Promise<void> {
    try {
      const last = await this.prisma.auditEvent.findFirst({
        where: { organizationId: input.organizationId },
        orderBy: { occurredAt: 'desc' },
        select: { eventHash: true },
      });
      const prevEventHash = last?.eventHash ?? null;

      const before = redactPii(input.beforeState);
      const after = redactPii(input.afterState);

      const occurredAt = new Date();
      const payload = stableStringify({
        prevEventHash,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        before,
        after,
        occurredAt: occurredAt.toISOString(),
      });
      const eventHash = createHash('sha256').update(payload).digest('hex');

      await this.prisma.auditEvent.create({
        data: {
          organizationId: input.organizationId,
          propertyId: input.propertyId ?? undefined,
          actorEmployeeId: input.actorEmployeeId ?? undefined,
          actorType: input.actorType ?? 'employee',
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? undefined,
          beforeState: before ?? undefined,
          afterState: after ?? undefined,
          metadata: (input.metadata as any) ?? {},
          prevEventHash: prevEventHash ?? undefined,
          eventHash,
          occurredAt,
        },
      });
    } catch (err) {
      this.logger.error('Neuspeo upis audit_event zapisa (ne prekida poslovnu operaciju):', err);
    }
  }

  private async resolveOrganizationId(propertyId: string): Promise<string | null> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { organizationId: true },
    });
    return property?.organizationId ?? null;
  }

  async findEventsForProperty(
    propertyId: string,
    filters: { from?: Date; to?: Date; actorEmployeeId?: string; resourceType?: string; action?: string },
  ) {
    const organizationId = await this.resolveOrganizationId(propertyId);
    if (!organizationId) return [];
    return this.findEvents(organizationId, filters);
  }

  async verifyChainForProperty(propertyId: string) {
    const organizationId = await this.resolveOrganizationId(propertyId);
    if (!organizationId) return { totalEvents: 0, valid: true, brokenEventIds: [] };
    return this.verifyChain(organizationId);
  }

  async findEvents(
    organizationId: string,
    filters: { from?: Date; to?: Date; actorEmployeeId?: string; resourceType?: string; action?: string },
  ) {
    return this.prisma.auditEvent.findMany({
      where: {
        organizationId,
        ...(filters.actorEmployeeId && { actorEmployeeId: filters.actorEmployeeId }),
        ...(filters.resourceType && { resourceType: filters.resourceType }),
        ...(filters.action && { action: { contains: filters.action } }),
        ...(filters.from || filters.to
          ? { occurredAt: { ...(filters.from && { gte: filters.from }), ...(filters.to && { lte: filters.to }) } }
          : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }

  /** Ponovo izračunava hash-lanac hronološki i poredi sa upisanim vrednostima — tamper-evidence provera. */
  async verifyChain(organizationId: string) {
    const events = await this.prisma.auditEvent.findMany({
      where: { organizationId },
      orderBy: { occurredAt: 'asc' },
    });

    let expectedPrev: string | null = null;
    const brokenAt: string[] = [];

    for (const e of events) {
      const payload = stableStringify({
        prevEventHash: expectedPrev,
        action: e.action,
        resourceType: e.resourceType,
        resourceId: e.resourceId ?? null,
        before: e.beforeState,
        after: e.afterState,
        occurredAt: e.occurredAt.toISOString(),
      });
      const recomputed = createHash('sha256').update(payload).digest('hex');

      if (e.prevEventHash !== expectedPrev || e.eventHash !== recomputed) {
        brokenAt.push(e.id);
      }
      expectedPrev = e.eventHash;
    }

    return {
      totalEvents: events.length,
      valid: brokenAt.length === 0,
      brokenEventIds: brokenAt,
    };
  }
}
