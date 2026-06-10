import { Module } from '@nestjs/common';

import { USERS_REPOSITORY } from './application/users.repository.port';
import { UsersService } from './application/users.service';
import { KyselyUsersRepository } from './infrastructure/kysely-users.repository';
import { MembershipsController } from './http/memberships.controller';
import { UsersController } from './http/users.controller';

/** Users & memberships contract group (ADR-009). */
@Module({
  controllers: [UsersController, MembershipsController],
  providers: [UsersService, { provide: USERS_REPOSITORY, useClass: KyselyUsersRepository }],
})
export class UsersModule {}
