import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { ApiToken } from 'src/provider/swagger/token';
import { AiProvider } from 'src/provider/ai/ai.provider';

@ApiTags('ai')
@ApiToken
@UseGuards(...AdminGuard)
@Controller('/api/admin/ai')
export class AiController {
  constructor(private readonly aiProvider: AiProvider) {}

  @Post('intro')
  async intro(@Body() body: { content: string }) {
    const content = body?.content || '';
    const intro = await this.aiProvider.generateIntro(content);
    return {
      statusCode: 200,
      data: { intro },
    };
  }
}
