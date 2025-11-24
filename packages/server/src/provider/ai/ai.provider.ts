import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';
import { SettingProvider } from '../setting/setting.provider';
import { AISetting } from 'src/types/setting.dto';

export interface AIConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  model: string;
  timeout: number;
}

@Injectable()
export class AiProvider {
  constructor(private readonly settingProvider: SettingProvider) {}

  async generateIntro(content: string): Promise<string> {
    const cfg = (await this.settingProvider.getAISetting()) as AISetting;
    if (!cfg.enabled || !cfg.apiKey || !cfg.endpoint || !cfg.model) {
      throw new InternalServerErrorException('请先配置AI功能');
    }
    const userPrompt = `请根据以下文章内容，用中文生成不超过100字的简介，突出主题，避免换行与多余标点：\n\n${content}`;
    try {
      const res = await axios({
        method: 'POST',
        url: `${cfg.endpoint}/chat/completions`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        timeout: cfg.timeout,
        data: {
          model: cfg.model,
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
