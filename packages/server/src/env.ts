import * as path from 'path';
import * as fs from 'fs';
import { config as dotenv } from 'dotenv';

try {
  const filename = process.env.NODE_ENV === 'production' ? '.env' : '.env.development';
  const filepath = path.resolve(filename);
  if (fs.existsSync(filepath)) {
    dotenv({ path: filepath });
  }
} catch {}
