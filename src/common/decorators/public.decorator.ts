import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public() — izuzima rutu iz JwtAuthGuard provere (npr. login endpoint).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
