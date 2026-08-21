import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * TenantMiddleware — izvlači property_id iz x-property-id headera i ubacuje
 * ga u request objekat kako bi svi servisi mogli da ga koriste bez ponovnog
 * čitanja headera. Detaljna izolacija na nivou baze primenjuje se u
 * PrismaService (RLS WHERE klauzule po propertyId).
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request & { propertyId?: string }, res: Response, next: NextFunction) {
    const propertyId = req.headers['x-property-id'] as string | undefined;

    // Propuštamo GET /api/v1 (health) bez provere
    if (req.path === '/api/v1' || req.path === '/api/docs') {
      return next();
    }

    if (!propertyId) {
      throw new BadRequestException(
        'Nedostaje x-property-id header. Svi API pozivi zahtevaju identifikator objekta.',
      );
    }

    // Osnovna validacija UUID formata
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(propertyId)) {
      throw new BadRequestException(
        'x-property-id mora biti validan UUID format.',
      );
    }

    req.propertyId = propertyId;
    next();
  }
}
