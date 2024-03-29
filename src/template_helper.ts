import * as fs from 'fs';
import * as path from 'path';

export class template_helper {
  _dir: string | undefined;
  _default_templates: Map<string, string>;
  _templates: Map<string, string>;
  constructor() {
    this._templates = new Map<string, string>();
    this._default_templates = new Map<string, string>();
  }

  async init_templates(dir: string) {
    this._dir = dir;
    this._default_templates.set('${FILENAME}.h', "//\n\
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
\n#endif  // ${HEADER_GUARD}\n");
    this._default_templates.set("${FILENAME}.cc", "//\n\
// Created by ${USER} on ${DATE}.\n\
// Copyright (c) ${YEAR} ${ORGANIZATION}. All rights reserved.\n\
//\n\
\n\
#include \"${HEADER_PATH}\"\n\
\n\
namespace ${NAMESPACE} {\n\
\n\
\n\
\n}  // namespace ${NAMESPACE}\n");
    this._default_templates.set("${FILENAME}_unittest.cc", "//\n\
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
}  // namespace ${NAMESPACE}\n");
    this._default_templates.set("${FILEPREFIX}${FILENAME}${FILESUFFIX}.h", `//
// Created by \${USER} on \${DATE}.
// Copyright (c) \${YEAR} \${ORGANIZATION}. All rights reserved.
//

#ifndef \${HEADER_GUARD}
#define \${HEADER_GUARD}

\${H_BODY}

#endif  // \${HEADER_GUARD}
`);
    this._default_templates.set("${FILEPREFIX}${FILENAME}${FILESUFFIX}.cc", `//
// Created by \${USER} on \${DATE}.
// Copyright (c) \${YEAR} \${ORGANIZATION}. All rights reserved.
//

#include "\${HEADER_PATH}"

\${CC_BODY}
`);
  }

  removeCache(name: string) {
    this._templates.delete(name);
  }

  async get_template(name: string): Promise<string> {
    // 先读缓存
    let ret = this._templates.get(name);
    if (ret) {
      return ret;
    }
    // 再读文件
    if (this._dir) {
      const file = path.join(this._dir, name);
      if (fs.existsSync(file)) {
        ret = fs.readFileSync(file, {'encoding': 'utf-8'});
        this._templates.set(name, ret);
        return ret;
      }
    }
    // 兜底默认值
    ret = this._default_templates.get(name) || `filegen: No template for "${name}"!`
    return ret;
  }
}