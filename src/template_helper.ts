import * as fs from 'fs';
import * as path from 'path';

export class template_helper {
  _dir: string | undefined;
  _templates: Map<string, string>;
  constructor() {
    this._templates = new Map<string, string>();
  }

  async init_templates(dir: string) {
    this._dir = dir;
    const default_templates = new Map<string, string>([
      ["${FILENAME}.h", "//\n\
// Created by ${USER} on ${DATE}.\n\
// Copyright (c) ${YEAR} ${ORGANIZATION}. All rights reserved.\n\
//\n\
\n\
#ifndef ${HEADER_GUARD}\n\
#define ${HEADER_GUARD}\n\
\n\
#include <cstring>\n\
\n\
namespace ${NAMESPACE} {\n\
\n\
class ${CLASSNAME} {\n\
 public:\n\
  \n\
 private:\n\
\n};\
\n\
\n}  // namespace ${NAMESPACE}\
\n\
\n#endif  // ${HEADER_GUARD}\n"]
        , ["${FILENAME}.cc", "//\n\
// Created by ${USER} on ${DATE}.\n\
// Copyright (c) ${YEAR} ${ORGANIZATION}. All rights reserved.\n\
//\n\
\n\
#include \"${HEADER_PATH}\"\n\
\n\
namespace ${NAMESPACE} {\n\
\n\
\n\
\n}  // namespace ${NAMESPACE}\n"]
        , ["${FILENAME}_unittest.cc", "//\n\
// Created by ${USER} on ${DATE}.\n\
// Copyright (c) ${YEAR} ${ORGANIZATION}. All rights reserved.\n\
//\n\
\n\
#include <gtest/gtest.h>\n\
${MODULE_INCLUDE}\
\n\
namespace ${NAMESPACE} {\n\
\n\
TEST(${CLASSNAME}Tests, test_any) {\n\
  ASSERT_EQ(1, 1);\n\
}\n\
\n\
}  // namespace ${NAMESPACE}\n"]]);
    if (!fs.existsSync(this._dir)) {
      fs.mkdirSync(this._dir);
    }
    for (let [key, content] of default_templates) {
      const file = path.join(this._dir, key);
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, content);
      }
    }
  }

  async get_template(name: string): Promise<string> {
    let ret = "filegen: No template!";
    if (this._templates.has(name)) {
      return this._templates.get(name) || ret;
    }
    // Read from file
    if (this._dir) {
      const file = path.join(this._dir, name);
      if (fs.existsSync(file)) {
        ret = fs.readFileSync(file, {'encoding': 'utf-8'});
      }
    }
    this._templates.set(name, ret);
    return ret;
  }

  async get_workspace_template(dir: string, name: string): Promise<string|undefined> {
    // Read from file
    const file = path.join(dir, 'filegen', name);
    if (!fs.existsSync(file)) {
      return undefined;
    }
    return fs.readFileSync(file, {'encoding': 'utf-8'});
  }
}