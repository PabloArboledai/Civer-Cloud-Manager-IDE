import { Module } from '@nestjs/common';
import { ProxyModule } from './modules/proxy/proxy.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [ProxyModule, DashboardModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
