import { removeID } from './removeId';
import { ArticleProvider } from 'src/provider/article/article.provider';
import { DraftProvider } from 'src/provider/draft/draft.provider';
import { MetaProvider } from 'src/provider/meta/meta.provider';
import { UserProvider } from 'src/provider/user/user.provider';
import { SettingProvider } from 'src/provider/setting/setting.provider';
import { CategoryProvider } from 'src/provider/category/category.provider';
import { WalineProvider } from 'src/provider/waline/waline.provider';
import { StaticProvider } from 'src/provider/static/static.provider';
import { VisitProvider } from 'src/provider/visit/visit.provider';
import { ViewerProvider } from 'src/provider/viewer/viewer.provider';

export async function restoreBackup(args: {
  data: any;
  mode: 'init' | 'import';
  walineRestartReason: string;
  providers: {
    articleProvider: ArticleProvider;
    draftProvider: DraftProvider;
    userProvider: UserProvider;
    metaProvider: MetaProvider;
    settingProvider: SettingProvider;
    categoryProvider: CategoryProvider;
    walineProvider: WalineProvider;
    staticProvider: StaticProvider;
    visitProvider: VisitProvider;
    viewerProvider: ViewerProvider;
  };
}) {
  const { data, mode, walineRestartReason, providers } = args;
  const {
    articleProvider,
    draftProvider,
    userProvider,
    metaProvider,
    settingProvider,
    categoryProvider,
    walineProvider,
    staticProvider,
    visitProvider,
    viewerProvider,
  } = providers;

  const { meta, user, setting, categories, waline } = data;
  let { articles, drafts, viewer, visit, static: staticItems } = data;

  articles = removeID(articles || []);
  drafts = removeID(drafts || []);
  viewer = removeID(viewer || []);
  visit = removeID(visit || []);
  if (staticItems) staticItems = removeID(staticItems);
  if (setting && setting.static) {
    setting.static = { ...setting.static, _id: undefined, __v: undefined };
  }

  if (user) {
    delete user._id;
    delete user.__v;
    if (mode === 'init') {
      await userProvider.createAdminFromBackup({
        id: 0,
        name: user.name,
        password: user.password,
        nickname: user.nickname,
        salt: user.salt,
      } as any);
    } else {
      await userProvider.updateUser(user);
    }
  }

  if (meta) {
    delete meta._id;
    const oldMeta = await metaProvider.getAll();
    if (oldMeta) {
      await metaProvider.update(meta);
    } else {
      await metaProvider.create(meta);
    }
    if (Array.isArray(meta.menus) && meta.menus.length) {
      await settingProvider.updateMenuSetting({ data: meta.menus } as any);
    }
  }

  await articleProvider.importArticles(articles || []);
  await draftProvider.importDrafts(drafts || []);
  if (categories && categories.length) {
    await categoryProvider.importCategories(categories);
  }

  await settingProvider.importSetting(setting || {});
  if (setting && setting.waline) {
    await walineProvider.restart(walineRestartReason);
  }
  if (waline && waline.comments && waline.comments.length) {
    await walineProvider.importComments(waline.comments);
    await walineProvider.restart('导入评论数据');
  }

  await staticProvider.importItems(staticItems || []);
  if (visit && visit.length) {
    await visitProvider.import(visit);
  }
  if (viewer && viewer.length) {
    await viewerProvider.import(viewer);
  }
}
