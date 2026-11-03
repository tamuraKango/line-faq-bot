import { Module } from '@nestjs/common';
import { WordpressService } from './wordpress.service.js';

@Module({
  providers: [WordpressService],
  exports: [WordpressService],
})
export class WordpressModule {}
