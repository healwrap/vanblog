import { Injectable, Logger } from '@nestjs/common';
import { ChildProcess, spawn } from 'node:child_process';
import { config } from 'src/config';
import { WalineSetting } from 'src/types/setting.dto';
import { makeSalt } from 'src/utils/crypto';
import { MetaProvider } from '../meta/meta.provider';
import { SettingProvider } from '../setting/setting.provider';
import { MongoClient, Db, ObjectId } from 'mongodb';
@Injectable()
export class WalineProvider {
  // constructor() {}
  ctx: ChildProcess = null;
  logger = new Logger(WalineProvider.name);
  env = {};
  constructor(
    private metaProvider: MetaProvider,
    private readonly settingProvider: SettingProvider,
  ) {}

  mapConfig2Env(config: WalineSetting) {
    const walineEnvMapping = {
      'smtp.port': 'SMTP_PORT',
      'smtp.host': 'SMTP_HOST',
      'smtp.user': 'SMTP_USER',
      'sender.name': 'SENDER_NAME',
      'sender.email': 'SENDER_EMAIL',
      'smtp.password': 'SMTP_PASS',
      authorEmail: 'AUTHOR_EMAIL',
      webhook: 'WEBHOOK',
      forceLoginComment: 'LOGIN',
      'forbidden.words': 'FORBIDDEN_WORDS',
      ipqps: 'IPQPS',
      'akismet.key': 'AKISMET_KEY',
    };
    const result = {};
    if (!config) {
      return result;
    }
    for (const key of Object.keys(config)) {
      if (key == 'forceLoginComment') {
        if (config.forceLoginComment) {
          result['LOGIN'] = 'force';
        }
      } else if (key == 'akismet.enabled') {
        if (config['akismet.enabled'] === false) {
          result['AKISMET_KEY'] = 'false';
        }
      } else if (key == 'otherConfig') {
        if (config.otherConfig) {
          try {
            const data = JSON.parse(config.otherConfig);
            for (const [k, v] of Object.entries(data)) {
              result[k] = v;
            }
          } catch (err) {}
        }
      } else {
        const rKey = walineEnvMapping[key];
        if (rKey) {
          const val = (config as any)[key];
          result[rKey] = typeof val === 'number' ? String(val) : val;
          console.log(rKey, result[rKey]);
        }
      }
    }
    if (!config['smtp.enabled']) {
      const r2 = {};
      for (const [k, v] of Object.entries(result)) {
        if (
          ![
            'SMTP_PASS',
            'SMTP_USER',
            'SMTP_HOST',
            'SMTP_PORT',
            'SENDER_NAME',
            'SENDER_EMAIL',
          ].includes(k)
        ) {
          r2[k] = v;
        }
      }
      return r2;
    }
    // console.log(result);
    return result;
  }
  async loadEnv() {
    const url = new URL(config.mongoUrl);
    const isDev = process.env.NODE_ENV === 'development';
    const host =
      isDev && (url.hostname === 'mongo' || url.hostname === '') ? '127.0.0.1' : url.hostname;
    const mongoEnv = {
      MONGO_HOST: host,
      MONGO_PORT: url.port,
      MONGO_USER: url.username,
      MONGO_PASSWORD: url.password,
      MONGO_DB: config.walineDB,
      MONGO_AUTHSOURCE: 'admin',
    };
    const siteInfo = await this.metaProvider.getSiteInfo();
    const otherEnv = {
      SITE_NAME: siteInfo?.siteName || undefined,
      SITE_URL: siteInfo?.baseUrl || undefined,
      JWT_TOKEN: global.jwtSecret || makeSalt(),
    };
    const walineConfig = await this.settingProvider.getWalineSetting();
    const walineConfigEnv = this.mapConfig2Env(walineConfig);
    this.env = {
      ...mongoEnv,
      ...otherEnv,
      ...walineConfigEnv,
    };
    if (!this.env['AKISMET_KEY']) {
      this.env['AKISMET_KEY'] = 'false';
    }
    this.logger.log(`waline 配置： ${JSON.stringify(this.env, null, 2)}`);
  }
  async init() {
    this.run();
  }
  async restart(reason: string) {
    this.logger.log(`${reason}重启 waline`);
    if (this.ctx) {
      await this.stop();
    }
    await this.run();
  }
  async stop() {
    if (this.ctx) {
      this.ctx.unref();
      process.kill(-this.ctx.pid);
      this.ctx = null;
      this.logger.log('waline 停止成功！');
    }
  }
  async run(): Promise<any> {
    await this.loadEnv();
    const base = require.resolve('@waline/vercel/vanilla.js');
    if (this.ctx == null) {
      this.ctx = spawn('node', [base], {
        env: {
          ...process.env,
          ...this.env,
        },
        cwd: process.cwd(),
        detached: true,
      });
      this.ctx.on('message', (message) => {
        this.logger.log(message);
      });
      this.ctx.on('exit', () => {
        this.ctx = null;
        this.logger.warn('Waline 进程退出');
      });
      this.ctx.stdout.on('data', (data) => {
        const t = data.toString();
        if (!t.includes('Cannot find module')) {
          this.logger.log(t.substring(0, t.length - 1));
        }
      });
      this.ctx.stderr.on('data', (data) => {
        const t = data.toString();
        this.logger.error(t.substring(0, t.length - 1));
      });
    } else {
      await this.stop();
      await this.run();
    }
    this.logger.log('Waline 启动成功！');
  }

  async getWalineDB(): Promise<Db> {
    const client = new MongoClient(config.mongoUrl);
    await client.connect();
    return client.db(config.walineDB);
  }

  async resolveCommentsCollectionNames(db: Db): Promise<string[]> {
    const cols = await db.listCollections().toArray();
    const names = cols.map((c) => c.name);
    const priority = ['Comment', 'Comments', 'comment', 'comments'];
    const existing = priority.filter((n) => names.includes(n));
    if (existing.length) return existing;
    const fuzzy = names.filter((n) => n.toLowerCase().includes('comment'));
    return fuzzy.length ? fuzzy : ['Comment'];
  }

  async exportComments(): Promise<any[]> {
    const db = await this.getWalineDB();
    const colNames = await this.resolveCommentsCollectionNames(db);
    const primary = colNames[0];
    const cursor = db.collection(primary).aggregate([
      {
        $replaceRoot: {
          newRoot: {
            $arrayToObject: {
              $map: {
                input: { $objectToArray: '$$ROOT' },
                as: 'kv',
                in: {
                  k: '$$kv.k',
                  v: {
                    $cond: [
                      { $eq: [{ $type: '$$kv.v' }, 'objectId'] },
                      { $toString: '$$kv.v' },
                      '$$kv.v',
                    ],
                  },
                },
              },
            },
          },
        },
      },
    ]);
    const list = await cursor.toArray();
    return list;
  }

  async importComments(docs: any[]): Promise<void> {
    if (!docs || !docs.length) return;
    const db = await this.getWalineDB();
    const colNames = await this.resolveCommentsCollectionNames(db);
    const deserialized = docs.map((d) => {
      const r: any = { ...d };
      for (const k of Object.keys(r)) {
        const v = r[k];
        if (k === '_id' && typeof v === 'string' && /^[a-fA-F0-9]{24}$/.test(v)) {
          r[k] = new ObjectId(v);
        } else if (k === 'pid' || k === 'rid') {
          // 保持为字符串以匹配 Waline 的查询逻辑
          r[k] = v;
        } else if (typeof v === 'string' && /^[a-fA-F0-9]{24}$/.test(v)) {
          r[k] = v; // 其他字段保留字符串
        }
      }
      return r;
    });
    for (const name of colNames) {
      await db.collection(name).deleteMany({});
      await db.collection(name).insertMany(deserialized);
    }
  }
}
