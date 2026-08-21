import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * @RequirePermissions('rooms:manage') — zahteva da ulogovani zaposleni ima
 * navedenu dozvolu (ili '*' wildcard) u Role.permissions.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
