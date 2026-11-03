import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { webhook } from '@line/bot-sdk';
import { LineService } from './line.service.js';

@Controller('webhook')
export class LineController {
  constructor(private readonly lineService: LineService) {}

  @Post()
  @HttpCode(200)
  handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-line-signature') signature: string | undefined,
  ): void {
    if (
      !signature ||
      !req.rawBody ||
      !this.lineService.verifySignature(req.rawBody, signature)
    ) {
      throw new UnauthorizedException();
    }

    // LINE には先に 200 を返し、返信処理は待たずに進める
    // （接続確認では events が空配列で届く）
    const body = req.body as webhook.CallbackRequest;
    void this.lineService.handleEvents(body.events ?? []);
  }
}
