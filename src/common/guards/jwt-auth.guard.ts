import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '../../modules/auth/auth.service';

/**
 * JwtAuthGuard — proverava Bearer token na svim rutama osim onih
 * označenih sa @Public(). Kada je token validan, upisuje payload u
 * request.employee i proverava da li se poklapa sa x-property-id
 * headerom koji je već upisao TenantMiddleware (sprečava zloupotrebu
 * tokena jednog objekta za pristup podacima drugog objekta).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException('Nedostaje autorizacioni token.');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Nevažeći ili istekao token.');
    }

    if (request.propertyId && payload.propertyId !== request.propertyId) {
      throw new ForbiddenException('Token ne pripada objektu iz x-property-id headera.');
    }

    request.employee = payload;
    return true;
  }
}
