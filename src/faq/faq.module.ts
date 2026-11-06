import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { WordpressModule } from '../wordpress/wordpress.module.js';
import { FaqService } from './faq.service.js';

@Module({
  imports: [WordpressModule, AiModule],
  providers: [FaqService],
  exports: [FaqService],
})
export class FaqModule {}
