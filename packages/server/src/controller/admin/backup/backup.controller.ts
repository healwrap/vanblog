import {
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ArticleProvider } from 'src/provider/article/article.provider';
import { AdminGuard } from 'src/provider/auth/auth.guard';
import { CategoryProvider } from 'src/provider/category/category.provider';
import { DraftProvider } from 'src/provider/draft/draft.provider';
import { MetaProvider } from 'src/provider/meta/meta.provider';
import { TagProvider } from 'src/provider/tag/tag.provider';
import { UserProvider } from 'src/provider/user/user.provider';
import * as fs from 'fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { ViewerProvider } from 'src/provider/viewer/viewer.provider';
import { VisitProvider } from 'src/provider/visit/visit.provider';
import { StaticProvider } from 'src/provider/static/static.provider';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { config } from 'src/config';
import { ApiToken } from 'src/provider/swagger/token';
import { WalineProvider } from 'src/provider/waline/waline.provider';
import { restoreBackup } from 'src/utils/restore';

@ApiTags('backup')
@UseGuards(...AdminGuard)
@ApiToken
@Controller('/api/admin/backup')
export class BackupController {
  private readonly logger = new Logger(BackupController.name);
  constructor(
    private readonly articleProvider: ArticleProvider,
    private readonly categoryProvider: CategoryProvider,
    private readonly tagProvider: TagProvider,
    private readonly metaProvider: MetaProvider,
    private readonly draftProvider: DraftProvider,
    private readonly userProvider: UserProvider,
    private readonly viewerProvider: ViewerProvider,
    private readonly visitProvider: VisitProvider,
    private readonly settingProvider: SettingProvider,
    private readonly staticProvider: StaticProvider,
    private readonly walineProvider: WalineProvider,
  ) {}

  @Get('export')
  async getAll(@Res() res: Response) {
    const articles = await this.articleProvider.getAll('admin', true);
    const categories = await this.categoryProvider.getAllCategories();
    const tags = await this.tagProvider.getAllTags(true);
    const meta = await this.metaProvider.getAll();
    const drafts = await this.draftProvider.getAll();
    const user = await this.userProvider.getUser();
    // 访客记录
    const viewer = await this.viewerProvider.getAll();
    const visit = await this.visitProvider.getAll();
    // 设置表
    const staticSetting = await this.settingProvider.getStaticSetting();
    const menuSetting = await this.settingProvider.getMenuSetting();
    const layoutSetting = await this.settingProvider.getLayoutSetting();
    const walineSetting = await this.settingProvider.getWalineSetting();
    const walineComments = await this.walineProvider.exportComments();
    const staticItems = await this.staticProvider.exportAll();
    if (menuSetting && (menuSetting as any).data) {
      meta.menus = (menuSetting as any).data;
    }
    const data = {
      articles,
      tags,
      meta,
      drafts,
      categories,
      user,
      viewer,
      visit,
      static: staticItems,
      setting: {
        static: staticSetting,
        layout: layoutSetting,
        waline: walineSetting,
      },
      waline: {
        comments: walineComments,
      },
    };
    // 拼接一个临时文件
    const name = `temp.json`;
    fs.writeFileSync(name, JSON.stringify(data, null, 2));
    res.download(name, (err) => {
      if (!err) {
        this.logger.log('success', 'download');
        return;
      }
      this.logger.error(err.stack);
      fs.rmSync(name);
    });
  }

  @Post('/import')
  @UseInterceptors(FileInterceptor('file'))
  async importAll(@UploadedFile() file: Express.Multer.File) {
    if (config.demo && config.demo == 'true') {
      return {
        statusCode: 401,
        message: '演示站禁止修改此项！',
      };
    }
    const json = file.buffer.toString();
    const data = JSON.parse(json);
    await restoreBackup({
      data,
      mode: 'import',
      walineRestartReason: '导入评论设置',
      providers: {
        articleProvider: this.articleProvider,
        draftProvider: this.draftProvider,
        userProvider: this.userProvider,
        metaProvider: this.metaProvider,
        settingProvider: this.settingProvider,
        categoryProvider: this.categoryProvider,
        walineProvider: this.walineProvider,
        staticProvider: this.staticProvider,
        visitProvider: this.visitProvider,
        viewerProvider: this.viewerProvider,
      },
    });
    return {
      statusCode: 200,
      data: '导入成功！',
    };
  }
}
