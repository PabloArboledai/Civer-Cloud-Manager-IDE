import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { isNestServerRunning, getNestServerStatus } from '../../main';

@Controller('api/dashboard')
export class DashboardController {
  @Get('status')
  async getStatus(@Res() res: FastifyReply) {
    const status = await getNestServerStatus();
    res.status(HttpStatus.OK).send({
      proxy: {
        running: status.running,
        port: status.port,
        base_url: status.base_url,
        active_accounts: status.active_accounts,
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version,
        platform: process.platform,
      },
      timestamp: new Date().toISOString(),
    });
  }

  @Get('health')
  async healthCheck(@Res() res: FastifyReply) {
    res.status(HttpStatus.OK).send({
      status: 'ok',
      server: 'AGM Proxy API',
      version: '0.10.0',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  }
}
