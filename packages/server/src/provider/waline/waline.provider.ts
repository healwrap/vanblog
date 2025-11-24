import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { MongoClient, ObjectId } from 'mongodb';
import type { ChildProcess } from 'node:child_process';
import type { Db } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { config } from 'src/config';
import type { WalineSetting } from 'src/types/setting.dto';
import { makeSalt } from 'src/utils/crypto';
import { checkOrCreate } from 'src/utils/checkFolder';
import { MetaProvider } from '../meta/meta.provider';
import { SettingProvider } from '../setting/setting.provider';
@Injectable()
export class WalineProvider {
  // constructor() {}
  ctx: ChildProcess = null;
  logger = new Logger(WalineProvider.name);
  env = {};
  private readonly walinePidFile = path.join(config.log, 'waline.pid');
  constructor(
    private metaProvider: MetaProvider,
    private readonly settingProvider: SettingProvider,
  ) {}

  private ensureLogDirReady() {
    try {
      checkOrCreate(config.log);
    } catch (err) {
      this.logger.error('创建日志目录失败', err as Error);
    }
  }

  private persistWalinePid(pid: number) {
    if (typeof pid !== 'number' || Number.isNaN(pid)) {
      return;
    }
    try {
      this.ensureLogDirReady();
      fs.writeFileSync(this.walinePidFile, String(pid), { encoding: 'utf-8' });
    } catch (err) {
      this.logger.error('写入 Waline pid 文件失败', err as Error);
    }
  }

  private removeWalinePidFile() {
    try {
      if (fs.existsSync(this.walinePidFile)) {
        fs.unlinkSync(this.walinePidFile);
      }
    } catch (err) {
      this.logger.error('删除 Waline pid 文件失败', err as Error);
    }
  }

  private async cleanupStaleWalineProcess() {
    this.ensureLogDirReady();
    if (!fs.existsSync(this.walinePidFile)) {
      return;
    }
    const rawPid = fs.readFileSync(this.walinePidFile, { encoding: 'utf-8' }).trim();
    const pid = Number(rawPid);
    if (!Number.isFinite(pid)) {
      this.removeWalinePidFile();
      return;
    }
    try {
      process.kill(pid, 0);
    } catch {
      this.removeWalinePidFile();
      return;
    }
    this.logger.warn(`检测到遗留 Waline 进程 (pid: ${pid})，尝试结束`);
    try {
      process.kill(pid, 'SIGTERM');
      await this.waitForPidExit(pid, 4000);
    } catch (err) {
      this.logger.warn(`Waline 进程 ${pid} 未能优雅退出，尝试强制结束`, err as Error);
      try {
        process.kill(pid, 'SIGKILL');
        await this.waitForPidExit(pid, 2000);
      } catch (killErr) {
        this.logger.error(`强制结束 Waline 进程 ${pid} 失败`, killErr as Error);
      }
    } finally {
      this.removeWalinePidFile();
    }
  }

  private async waitForPidExit(pid: number, timeout = 4000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      await this.sleep(200);
      try {
        process.kill(pid, 0);
      } catch {
        return;
      }
    }
    throw new Error(`进程 ${pid} 仍在运行`);
  }

  private waitChildProcessExit(child: ChildProcess, timeout = 5000): Promise<void> {
    if (!child || child.exitCode !== null) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.removeListener('exit', onExit);
        reject(new Error('Waline 进程退出超时'));
      }, timeout);
      const onExit = () => {
        clearTimeout(timer);
        resolve();
      };
      child.once('exit', onExit);
    });
  }

  private sleep(duration: number) {
    return new Promise((resolve) => setTimeout(resolve, duration));
  }

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
      if (key === 'forceLoginComment') {
        if (config.forceLoginComment) {
          result['LOGIN'] = 'force';
        }
      } else if (key === 'akismet.enabled') {
        if (config['akismet.enabled'] === false) {
          result['AKISMET_KEY'] = 'false';
        }
      } else if (key === 'otherConfig') {
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
    this.env['DB'] = 'mongo';
    this.env['DRIVER'] = 'mongo';
    this.env['DATABASE_URL'] = config.mongoUrl;
    this.env['MONGO_URL'] = config.mongoUrl;
    this.env['MONGO_URI'] = config.mongoUrl;
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
    if (!this.ctx) {
      await this.cleanupStaleWalineProcess();
      return;
    }
    const child = this.ctx;
    try {
      child.kill('SIGTERM');
    } catch (err) {
      this.logger.warn('发送 SIGTERM 到 Waline 失败', err as Error);
    }
    try {
      await this.waitChildProcessExit(child);
    } catch (err) {
      this.logger.warn('Waline 停止超时，尝试 SIGKILL', err as Error);
      try {
        child.kill('SIGKILL');
      } catch (killErr) {
        this.logger.error('强制停止 Waline 失败', killErr as Error);
      }
      await this.waitChildProcessExit(child, 2000).catch(() => undefined);
    } finally {
      this.removeWalinePidFile();
      this.ctx = null;
      this.logger.log('waline 停止成功！');
    }
  }
  async run(): Promise<any> {
    await this.loadEnv();
    await this.cleanupStaleWalineProcess();
    let base: string;
    try {
      base = require.resolve('@waline/vercel/vanilla.js');
    } catch (err) {
      this.logger.warn('主进程未安装 Waline 依赖，尝试回退到子包', err as Error);
      const walinePkg = path.join(path.resolve(process.cwd(), '..'), 'waline', 'package.json');
      const walineRequire = createRequire(walinePkg);
      base = walineRequire.resolve('@waline/vercel/vanilla.js');
    }
    if (this.ctx == null) {
      this.ctx = spawn('node', [base], {
        env: {
          ...process.env,
          ...this.env,
          NODE_PATH: ['/app/waline/node_modules', process.env.NODE_PATH || ''].join(':'),
        },
        cwd: path.join(path.resolve(process.cwd(), '..'), 'waline'),
      });
      this.persistWalinePid(this.ctx.pid);
      this.ctx.on('message', (message) => {
        this.logger.log(message);
      });
      this.ctx.on('exit', () => {
        this.removeWalinePidFile();
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
