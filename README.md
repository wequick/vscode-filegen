# VSCode File Generator

Create files in your format.

Supported generators:
* C++ Class & UnitTest file with Google Style.
* TODO: more

## Configuration

### filegen.json

Create in your project root.

```json
{
   "module": "mymodule",  // The C++ modalar header
   "namespace": "wq",  // The C++ class namespace
   "organization": "Wequick",  // The organization show in copyright
}
```

### template files

Depending on your platform, the global template path is located here:

* Windows %APPDATA%\Code\User\globalStorage\wequick.filegen.
* macOS $HOME/Library/Application\ Support/Code/User/globalStorage/wequick.filegen.
* Linux $HOME/.config/Code/User/globalStorage/wequick.filegen.

Or you can create `filegen` folder in your project root to overwrite.

Files:
```
filegen
  |____${FILENAME}.h            // [cpp] header file
  |____${FILENAME}.cc           // [cpp] source file
  |____${FILENAME}_unittest.cc  // [cpp] unittest file
```

#### [cpp] header file

Default as:

```cpp
//
// Created by ${USER} on ${DATE}.
// Copyright (c) ${YEAR} ${ORGANIZATION}. All rights reserved.
//

#ifndef ${HEADER_GUARD}
#define ${HEADER_GUARD}

#include <cstring>

namespace ${NAMESPACE} {

class ${CLASSNAME} {
 public:
  
 private:
};

}  // namespace ${NAMESPACE}

#endif  // ${HEADER_GUARD}"

```

#### [cpp] source file

Default as:

```cpp
//
// Created by ${USER} on ${DATE}.
// Copyright (c) ${YEAR} ${ORGANIZATION}. All rights reserved.
//

#include "${HEADER_PATH}"

namespace ${NAMESPACE} {


}  // namespace ${NAMESPACE}

```

#### [cpp] unittest file

Default as:

```cpp
//
// Created by ${USER} on ${DATE}.
// Copyright (c) ${YEAR} ${ORGANIZATION}. All rights reserved.
//

#include <gtest/gtest.h>
${MODULE_INCLUDE}

namespace ${NAMESPACE} {

TEST(${CLASSNAME}Tests, test_any) {
  ASSERT_EQ(1, 1);
}

}  // namespace ${NAMESPACE}

```

## Variables

The variable format is `${KEY}`, the `KEY` supports following:

* **FILENAME** - The file name your input. e.g. `file_generator`
* **CLASSNAME** - The class name. From the file name in camel style, e.g. `FileGenerator`
* **USER** - The user. Configured by `git config user.name [USER]`. e.g. `Galen Lin`
* **ORGANIZATION** - The organization. Configured by `organization` filed in `filegen.json` file. e.g. `Wequick`
* **YEAR** - The year of now. e.g. `2023`
* **DATE** - The date of now. Format as 'YYYY-MM-DD', e.g. `2023-07-17`
* **HEAD_GUARD** - The google-style header guard. From the relative-path-to-project-root in upper case, e.g. `WEQUICK_FILE_GENERATOR_H_`
* **HEADER_PATH** - The current header path. From the relative-path-to-project-root join with the file name. e.g. `wequick/file_generator.h`
* **MODULE_INCLUDE** - The modular header includement. If `module` is specified in `filegen.json` then returns  '#include <`module`/`module`.h>\n', e.g. `#include <mymodule/mymodule.h>\n`
* **NAMESPACE** - The class namespace. Returns the `namespace` field specified in `filegen.json` or fallback to the project root directory name. e.g. `myproject`
