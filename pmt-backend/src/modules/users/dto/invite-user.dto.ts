import { IsEmail, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

// SYSTEM_ADMIN is excluded. It's a single account created only at
// bootstrap, and can never be invited via the API.
const INVITABLE_ROLES = Object.values(Role).filter(
  (role) => role !== Role.SYSTEM_ADMIN,
);

export class InviteUserDto {
  @ApiProperty({ example: 'newdev@pixelvega.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'New Developer' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: INVITABLE_ROLES, example: 'DEVELOPER' })
  @IsIn(INVITABLE_ROLES)
  role!: Role;
}
