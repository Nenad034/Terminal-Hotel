import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { JwtPayload } from '../../modules/auth/auth.service';

/**
 * PermissionsGuard — proverava da li employee.permissions (iz JWT-a) sadrži
 * bar jednu od dozvola zahtevanih preko @RequirePermissions(). Wildcard '*'
 * u Role.permissions daje pristup svemu (npr. rola "Manager").
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const employee: JwtPayload | undefined = request.employee;

    if (!employee) {
      return false;
    }

    if (employee.permissions.includes('*')) {
      return true;
    }

    const hasPermission = requiredPermissions.some((p) => employee.permissions.includes(p));
    if (!hasPermission) {
      throw new ForbiddenException(
        `Nedostaje dozvola: ${requiredPermissions.join(' ili ')}.`,
      );
    }

    return true;
  }
}
