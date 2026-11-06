import { Module } from '@nestjs/common';
import { FaqModule } from '../faq/faq.module.js';
import { LineController } from './line.controller.js';
import { LineService } from './line.service.js';

@Module({
  imports: [FaqModule],
  controllers: [LineController],
  providers: [LineService],
})
export class LineModule {}
