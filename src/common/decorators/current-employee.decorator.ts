import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../../modules/auth/auth.service';

/**
 * @CurrentEmployee() — izvlači dekodovani JWT payload ulogovanog zaposlenog
 * koji je upisao JwtAuthGuard.
 */
export const CurrentEmployee = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.employee;
  },
);
