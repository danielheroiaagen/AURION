import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import type { Page } from '../../../common/pagination/cursor';
import type { UserStatus } from '../../../database/database.schema';
import {
  ASSIGNABLE_ROLES,
  MEMBERSHIP_SETTABLE_STATUSES,
  type AssignableRole,
  type MembershipSettableStatus,
} from '../domain/membership';
import type { TenantUser } from '../application/users.repository.port';

const MEMBERSHIP_STATUSES = ['active', 'invited', 'disabled'] as const;

export class InviteUserDto {
  @ApiProperty({ description: 'Email of the user to invite (global identity key).' })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ description: 'Display name for a newly created identity.' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  display_name!: string;

  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES)
  role!: AssignableRole;
}

export class UpdateMembershipDto {
  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLES })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: AssignableRole;

  @ApiPropertyOptional({ enum: MEMBERSHIP_SETTABLE_STATUSES })
  @IsOptional()
  @IsIn(MEMBERSHIP_SETTABLE_STATUSES)
  status?: MembershipSettableStatus;
}

export class ListUsersQueryDto {
  @ApiPropertyOptional({ enum: ASSIGNABLE_ROLES })
  @IsOptional()
  @IsIn(ASSIGNABLE_ROLES)
  role?: AssignableRole;

  @ApiPropertyOptional({ enum: MEMBERSHIP_STATUSES, description: 'Membership status filter.' })
  @IsOptional()
  @IsIn(MEMBERSHIP_STATUSES)
  status?: UserStatus;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ description: 'Opaque cursor from a previous page.' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

/** Stable response shape (ADR-009): snake_case, ISO-8601 timestamps. */
export interface TenantUserResponse {
  membership_id: string;
  tenant_id: string;
  user_id: string;
  email: string;
  display_name: string;
  user_status: string;
  role: string;
  membership_status: string;
  created_at: string;
  updated_at: string;
}

export function toTenantUserResponse(user: TenantUser): TenantUserResponse {
  return {
    membership_id: user.id,
    tenant_id: user.tenantId,
    user_id: user.userId,
    email: user.email,
    display_name: user.displayName,
    user_status: user.userStatus,
    role: user.role,
    membership_status: user.membershipStatus,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };
}

export interface TenantUserListResponse {
  items: TenantUserResponse[];
  next_cursor: string | null;
}

export function toTenantUserListResponse(page: Page<TenantUser>): TenantUserListResponse {
  return {
    items: page.items.map(toTenantUserResponse),
    next_cursor: page.nextCursor,
  };
}
