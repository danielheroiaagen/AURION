import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok'; service: 'aurion-api' } {
    return {
      status: 'ok',
      service: 'aurion-api',
    };
  }
}
