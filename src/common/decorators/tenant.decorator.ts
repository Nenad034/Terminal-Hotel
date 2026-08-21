import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @PropertyId() — dekorator koji izvlači propertyId iz request objekta
 * koji je prethodno upisao TenantMiddleware.
 *
 * Primer upotrebe u kontroleru:
 *   async getRooms(@PropertyId() propertyId: string) { ... }
 */
export const PropertyId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.propertyId;
  },
);
