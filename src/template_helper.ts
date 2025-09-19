import * as fs from 'fs';
import * as path from 'path';

export class template_helper {
  _template_paths: string[];
  _templates: Map<string, string>;
  constructor() {
    this._template_paths = [];
    this._templates = new Map<string, string>();
  }

  set_template_paths(dirs: string[]) {
    this._template_paths = dirs;
  }

  removeCache(file_path: string) {
    let name = path.basename(file_path)
    let lang = path.basename(path.dirname(file_path))
    if (lang == 'filegen') {
      lang = 'cpp'
    }
    this._templates.delete(`${lang}/${name}`);
  }

  async get_template(lang: string, name: string): Promise<string> {
    // 先读缓存
    let key = `${lang}/${name}`
    let ret = this._templates.get(key);
    if (ret) {
      return ret;
    }
    // 再读文件
    for (let dir of this._template_paths) {
      let file = path.join(dir, key);
      if (fs.existsSync(file)) {
        ret = fs.readFileSync(file, {'encoding': 'utf-8'});
        this._templates.set(name, ret);
        return ret;
      }
    }
    return `filegen: No template for "${key}"!`;
  }
}