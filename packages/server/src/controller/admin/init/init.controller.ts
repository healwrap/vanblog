import {
  Body,
  Controller,
  HttpException,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InitDto } from 'src/types/init.dto';
import { InitProvider } from 'src/provider/init/init.provider';
import { ISRProvider } from 'src/provider/isr/isr.provider';
import { StaticProvider } from 'src/provider/static/static.provider';
import { ApiToken } from 'src/provider/swagger/token';
import { FileInterceptor } from '@nestjs/platform-express';
import { removeID } from 'src/utils/removeId';
import { ArticleProvider } from 'src/provider/article/article.provider';
import { DraftProvider } from 'src/provider/draft/draft.provider';
import { MetaProvider } from 'src/provider/meta/meta.provider';
import { UserProvider } from 'src/provider/user/user.provider';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { VisitProvider } from 'src/provider/visit/visit.provider';
import { ViewerProvider } from 'src/provider/viewer/viewer.provider';
import { CategoryProvider } from 'src/provider/category/category.provider';
import { WalineProvider } from 'src/provider/waline/waline.provider';

@ApiTags('init')
@ApiToken
@Controller('/api/admin')
export class InitController {
  constructor(
    private readonly initProvider: InitProvider,
    private readonly staticProvider: StaticProvider,
    private readonly isrProvider: ISRProvider,
    private readonly articleProvider: ArticleProvider,
    private readonly draftProvider: DraftProvider,
    private readonly metaProvider: MetaProvider,
    private readonly userProvider: UserProvider,
    private readonly settingProvider: SettingProvider,
    private readonly visitProvider: VisitProvider,
    private readonly viewerProvider: ViewerProvider,
    private readonly categoryProvider: CategoryProvider,
    private readonly walineProvider: WalineProvider,
  ) {}
  private isInitializing = false;
  private isRestoring = false;

  @Post('/init')
  async initSystem(@Body() initDto: InitDto) {
    const hasInit = await this.initProvider.checkHasInited();
    if (hasInit) {
      throw new HttpException('已初始化', 500);
    }
    if (this.isInitializing) {
      throw new HttpException('处理中', 429);
    }
    this.isInitializing = true;
    try {
      await this.initProvider.init(initDto);
      this.isrProvider.activeAll('初始化触发增量渲染！', undefined, {
        forceActice: true,
      });
      return {
        statusCode: 200,
        message: '初始化成功!',
      };
    } finally {
      this.isInitializing = false;
    }
  }

  @Post('/init/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImg(@UploadedFile() file: any, @Query('favicon') favicon: string) {
    const hasInit = await this.initProvider.checkHasInited();
    if (hasInit) {
      throw new HttpException('已初始化', 500);
    }
    let isFavicon = false;
    if (favicon && favicon == 'true') {
      isFavicon = true;
    }
    const res = await this.staticProvider.upload(file, 'img', isFavicon);
    return {
      statusCode: 200,
      data: res,
    };
  }

  @Post('/init/restore')
  @UseInterceptors(FileInterceptor('file'))
  async restoreByBackup(@UploadedFile() file: Express.Multer.File) {
    const hasInit = await this.initProvider.checkHasInited();
    if (hasInit) {
      throw new HttpException('已初始化', 500);
    }
    if (this.isRestoring) {
      throw new HttpException('处理中', 429);
    }
    this.isRestoring = true;
    const json = file.buffer.toString();
    const data = JSON.parse(json);
    const { meta, user, setting, categories } = data;
    let { articles, drafts, viewer, visit, static: staticItems } = data;
    articles = removeID(articles || []);
    drafts = removeID(drafts || []);
    viewer = removeID(viewer || []);
    visit = removeID(visit || []);
    if (staticItems) {
      staticItems = removeID(staticItems);
    }
    if (setting && setting.static) {
      setting.static = { ...setting.static, _id: undefined, __v: undefined };
    }
    if (user) {
      delete user._id;
      delete user.__v;
      await this.userProvider.createAdminFromBackup({
        id: 0,
        name: user.name,
        password: user.password,
        nickname: user.nickname,
        salt: user.salt,
      } as any);
    }
    if (meta) {
      delete meta._id;
      const oldMeta = await this.metaProvider.getAll();
      if (oldMeta) {
        await this.metaProvider.update(meta);
      } else {
        await this.metaProvider.create(meta);
      }
    }
    await this.articleProvider.importArticles(articles || []);
    await this.draftProvider.importDrafts(drafts || []);
    if (categories && categories.length) {
      await this.categoryModalImport(categories);
    }
    await this.settingProvider.importSetting(setting || {});
    if (setting && setting.waline) {
      await this.walineProvider.restart('初始化恢复评论设置');
    }
    await this.staticProvider.importItems(staticItems || []);
    if (visit) {
      await this.visitProvider.import(visit);
    }
    if (viewer) {
      await this.viewerProvider.import(viewer);
    }
    try {
      await this.isrProvider.activeAll('初始化恢复触发增量渲染！', undefined, {
        forceActice: true,
      });
      return {
        statusCode: 200,
        data: '恢复成功！',
      };
    } finally {
      this.isRestoring = false;
    }
  }
  private async categoryModalImport(categories: any[]) {
    await this.categoryProvider.importCategories(categories);
  }
}
