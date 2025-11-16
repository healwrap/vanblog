import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import { loadConfig } from 'src/utils/loadConfig';

export interface AIConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  model: string;
  timeout: number;
}

@Injectable()
export class AiProvider {
  private cfg: AIConfig;
  constructor() {
    this.cfg = {
      enabled: (loadConfig('ai.enabled', 'true') as string) !== 'false',
      endpoint: loadConfig('ai.endpoint', ''),
      apiKey: loadConfig('ai.apiKey', ''),
      model: loadConfig('ai.model', ''),
      timeout: parseInt(loadConfig('ai.timeout', '15000') as string),
    };
  }

  async generateIntro(content: string): Promise<string> {
    if (!this.cfg.enabled) {
      throw new InternalServerErrorException('AI 功能未启用');
    }
    if (!this.cfg.apiKey) {
      throw new InternalServerErrorException('缺少 AI Key');
    }
    const userPrompt = `请根据以下文章内容，用中文生成不超过100字的简介，突出主题，避免换行与多余标点：\n\n${content}`;
    try {
      const res = await axios({
        method: 'POST',
        url: `${this.cfg.endpoint}/chat/completions`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cfg.apiKey}`,
        },
        timeout: this.cfg.timeout,
        data: {
          model: this.cfg.model,
          messages: [
            { role: 'system', content: '你是一名博客编辑，负责生成精炼的文章简介。' },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 200,
        },
      });
      const output = res?.data?.choices?.[0]?.message?.content?.trim();
      if (!output) {
        throw new InternalServerErrorException('AI 未返回内容');
      }
      return output.length > 120 ? output.slice(0, 120) : output;
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'AI 简介生成失败';
      throw new InternalServerErrorException(msg);
    }
  }
}
