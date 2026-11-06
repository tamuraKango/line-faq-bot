import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  // Render の稼働確認と、デモの前にブラウザで開いて bot を起こすために使う
  @Get()
  health(): string {
    return 'ok';
  }
}
