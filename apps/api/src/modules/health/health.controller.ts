import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: 'ok'; service: 'aurion-api' } {
    return {
      status: 'ok',
      service: 'aurion-api',
    };
  }
}
