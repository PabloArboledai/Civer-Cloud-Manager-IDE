import { Module } from '@nestjs/common';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';
import { TokenManagerService } from './token-manager.service';
import { GeminiClient } from './clients/gemini.client';
import { OpenAIClient } from './clients/openai.client';
import { GeminiController } from './gemini.controller';
import { ProxyGuard } from './proxy.guard';
import { OpenAIProviderSchedulerService } from './openai-provider-scheduler.service';

@Module({
  imports: [],
  controllers: [ProxyController, GeminiController],
  providers: [
    ProxyService,
    TokenManagerService,
    GeminiClient,
    OpenAIClient,
    OpenAIProviderSchedulerService,
    ProxyGuard,
  ],
  exports: [TokenManagerService, OpenAIProviderSchedulerService],
})
export class ProxyModule {}
