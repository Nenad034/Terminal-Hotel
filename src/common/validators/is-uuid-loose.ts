import { registerDecorator, ValidationOptions } from 'class-validator';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @IsUuidLoose() — validira UUID format bez zahteva za RFC 4122 verzioni bit
 * (1-5). Class-validator-ov @IsUUID() to zahteva, pa odbacuje "nil"-stil
 * seed ID-jeve kao '00000000-0000-0000-0000-000000000002' koje ovaj projekat
 * koristi za organizaciju/property/role fixture podatke — ista šema koju već
 * primenjuje TenantMiddleware za x-property-id header.
 */
export function IsUuidLoose(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isUuidLoose',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} mora biti validan UUID format.`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && UUID_PATTERN.test(value);
        },
      },
    });
  };
}
