import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Ista (nešto blaža od RFC 4122) šema koju koristi TenantMiddleware — prihvata
// i seed fixture ID-jeve poput 00000000-0000-0000-0000-000000000002.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class LoginDto {
  @ApiProperty({ description: 'UUID hotela (objekta) u kojem je zaposleni zaveden' })
  @Matches(UUID_PATTERN, { message: 'propertyId mora biti validan UUID format.' })
  propertyId: string;

  @ApiProperty({ example: 'ana.recepcija@grandhotel.rs' })
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}
