//
// Created by Galen Lin on 2024/03/28.
// Copyright (c) 2024 Wequick. All rights reserved.
//

interface Gmock {
  code?: string;
  origClassName?: string;
  constructors: string[];
}

interface ConstructorCode {
  descCode?: string;
  implCode?: string;
}

interface VirtualFunction {
  beforeVirtual: string;
  returnType: string;
  functionName: string;
  args: string;
  modifier: string;
  arfterArgs: string;
  argsCount: number;
}

class Field {
  name: string = '';
  type: string = '';
  constructor(type: string, name: string) {
    this.type = type;
    this.name = name;
  }
}

interface Code {
  code?: string;
  namespace?: string;
  headerGuard?: string;
  className?: string;
}

interface ExtractData {
  fileName: string;
  hBody: string;
  cBody: string;
}

interface ExtractResult {
  error?: string;
  data?: ExtractData;
}

export class GmockHelper {

  private getArgsCount(args: string): number {
    // (StreamerLogType type,
    //  const std::string& event,
    //  const std::string& subEvent,
    //  const std::shared_ptr<std::map<std::string, std::string>> standardArgs) = 0;
    if (/\([\s|\n]*\)/.test(args)) {
      return 0;
    }
    // 替换泛型为空，避免多余的逗号影响判断
    args = args.replace(/\<[^\>]+\>/g, '');
    return args.split(',').length;
  }

  private parseVirtualFunction(text: string): VirtualFunction | undefined {
    const virtualTag = "virtual ";
    const argsStartTag = "(";
    const index = text.indexOf(virtualTag);
    if (index < 0) {
      return;
    }
    const beforeVirtual = text.substring(0, index);
    const index2 = text.indexOf(argsStartTag, index + virtualTag.length);
    if (index2 < 0) {
      return;
    }
    const index3 = text.indexOf(";", index2 + argsStartTag.length);
    if (index3 < 0) {
      return;
    }
    const typeAndFunctionName = text.substring(index + virtualTag.length, index2);
    let args = text.substring(index2, index3);
    const arfterArgs = text.substring(index3 + 1);
    const functionNamePattern = /([\w|_][\w|_|\d]+)$/;
    const functionNameMatch = functionNamePattern.exec(typeAndFunctionName);
    if (functionNameMatch == null) {
      return;
    }
    const functionName = functionNameMatch[1];
    const returnType = typeAndFunctionName.substring(0, functionNameMatch.index).trim();
    let modifier = '';
    const index4 = args.lastIndexOf(")");
    if (index4 > 0) {
      modifier = args.substring(index4 + 1);
      args = args.substring(0, index4 + 1);
    }
    // var = nullptr, var = "", var = 0
    // -->
    // var
    args = args.replace(/\s*=\s*["|\d|\w|\.]+/g, "");
    const argsCount = this.getArgsCount(args);
    return { beforeVirtual, returnType, functionName, args, modifier, arfterArgs, argsCount };
  }

  private toGmockFunction(text: string): string {
    // virtual unsigned char * Hello(int a,
    //   int b,
    //   std::unique_ptr<char> c,
    //   char *d);
    // virtual std::unique_ptr<char> Hello2(int a,
    //   int b,
    //   std::unique_ptr<char> c,
    //   char *d);
    const fun = this.parseVirtualFunction(text);
    if (!fun) {
      return text;
    }
    const modifier = fun.modifier.indexOf('const') >= 0 ? '_CONST' : '';
    return `${fun.beforeVirtual}MOCK${modifier}_METHOD${fun.argsCount}(${fun.functionName}, ${fun.returnType}${fun.args});${fun.arfterArgs}`;
  }

  private parseClassDeclare(text: string): { [key: string]: string } {
    // class Application : public a
    //                   , public b {
    // -->
    // class MockApplication : public Application {
    // 去除宏定义
    text = text.replace(/class [A-Z|_]+\s+([\w|_])/, "class $1");
    const classTag = "class ";
    const index = text.indexOf(classTag);
    if (index < 0) {
      return { mock: text };
    }
    const index2 = text.indexOf("{", index + classTag.length);
    if (index2 < 0) {
      return { mock: text };
    }
    const head = text.substring(0, index);
    const tail = text.substring(index2 + 1);
    let index3 = text.indexOf(":", index + classTag.length);
    if (index3 < 0) {
      index3 = index2;
    }
    const className = text.substring(index + classTag.length - 1, index3).trim();
    return { head, tail, className, mock: `${head}class Mock${className} : public ${className} {${tail}` };
  }

  private toGmockConstructor(code: string, className: string): ConstructorCode {
    let ret: ConstructorCode = { descCode: undefined, implCode: undefined };

    // SysPropInterface(int a) : BaseClass(a) {}
    // ->
    // descCode = MockSysPropInterface(int a);
    // implCode = MockSysPropInterface::MockSysPropInterface(int a) : SysPropInterface(a) {}

    const tag = className + "(";
    const index = code.indexOf(tag);
    if (index < 0) {
      return ret;
    }
    const index2 = code.indexOf(")", index + tag.length);
    if (index2 < 0) {
      return ret;
    }
    const args = code.substring(index + tag.length, index2).trim();
    ret.descCode = `${code.substring(0, index)}Mock${className}(${args});`;
    let implCode = `Mock${className}::Mock${className}(${args}) : ${className}(`;
    const fields = this.getFields(args, ',', '');
    implCode += fields.map(it => it.name).join(', ');
    implCode += ') {}';
    ret.implCode = implCode;

    return ret;
  }

  public toGmock(text: string): Gmock {
    let gmock: Gmock = { code: undefined, origClassName: undefined, constructors: [] };
    let isVirtualStart = false;
    let isVirtualEnd = false;
    let virtualCode = '';
    let fullCode = '';
    let classCode = '';
    let isClassStart = false;
    let isClassEnd = false;
    let isNotPublicStart = false;
    let className = undefined;
    let constructorCode = '';
    let isConstructorStart = false;
    let isInternalClassStart = false;
    let classCount = 0;
    let firstAddConstructor = true;
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSep = i == lines.length - 1 ? '' : '\n';
      if (line.indexOf("~") >= 0) {  // ignore deconstructor
        continue;
      }
      if (line.indexOf("protected:") >= 0
        || line.indexOf("private:") >= 0) {
        isNotPublicStart = true;
      } else if (line.indexOf("public:") >= 0 || line.indexOf("};") >= 0) {
        isNotPublicStart = false;
      }
      if (isNotPublicStart) {
        continue;
      }
      const currIsClassStart = line.indexOf('class ') >= 0;
      if (currIsClassStart) {
        classCount++;
        if (classCount == 1) {
          isClassStart = true;
        }
      }
      if (isClassStart && line.indexOf('{') >= 0) {
        isClassEnd = true;
      }
      if (isClassStart) {
        classCode += line + lineSep;
      }

      const currStart = line.indexOf("virtual ") >= 0;
      const currEnd = line.indexOf(";") >= 0;
      if (currStart) {
        isVirtualStart = true;
      }
      if (isVirtualStart && currEnd) {
        isVirtualEnd = true;
      }
      if (isVirtualStart) {
        virtualCode += line + lineSep;
      }

      if (className) {
        if (line.indexOf('enum ') >= 0 ||
          (currIsClassStart && classCount > 1) ||
          line.indexOf('struct ') >= 0) {
          isInternalClassStart = true;
        }
      }
      if (isInternalClassStart) {
        if (line.indexOf('}') >= 0) {
          isInternalClassStart = false;
        }
        continue;
      }

      if (className && line.indexOf('static') < 0 && line.indexOf(className + '(') >= 0) {
        isConstructorStart = true;
      }
      if (isConstructorStart) {
        constructorCode += line + lineSep;
        if (line.indexOf(";") >= 0 || line.indexOf("}") >= 0) {
          isConstructorStart = false;
          const gc = this.toGmockConstructor(constructorCode, className!);
          if (gc.descCode) {
            if (firstAddConstructor) {
              firstAddConstructor = false;
              fullCode += gc.descCode + '\n';
              fullCode += `  ~Mock${className}();` + lineSep;
            } else {
              fullCode += gc.descCode + lineSep;
            }
            gmock.constructors.push(gc.implCode!);
            continue;
          }
        }
      }

      if (!isVirtualStart && !isClassStart && !isConstructorStart) {
        fullCode += line + lineSep;
      }

      if (isClassEnd) {
        // class 替换为 mock
        const dec = this.parseClassDeclare(classCode);
        className = dec.className;
        gmock.origClassName = className;
        fullCode += dec.mock;
        classCode = "";
        isClassEnd = false;
        isClassStart = false;
      }

      if (isVirtualEnd) {
        virtualCode = this.toGmockFunction(virtualCode);
        fullCode += virtualCode;
        // TODO(galen): 暂不支持多个 virtual 在一行的情况
        virtualCode = "";
        isVirtualStart = false;
        isVirtualEnd = false;
      }
      if (i == lines.length - 1) {
        // 最后一行，不完整的保留
        if (isClassStart && !isClassEnd) {
          fullCode += classCode;
        }
        if (isVirtualStart && !isVirtualEnd) {
          fullCode += virtualCode;
        }
      }
    }
    gmock.code = fullCode;
    return gmock;
  }

  private getFields(classCode: string, sep: string = '\n', suffix: string = ';'): Field[] {
    const fields: Field[] = [];
    const lines = classCode.split(sep);
    /*struct MyStruct {
      int a;
      char b[256];
      char *c;
      std::string s;
      std::unique_ptr<std::map<std::string, std::string>> x;
    };*/
    let bracketsCount = 0;
    const objectRegex = new RegExp(`([\\w|:|<|>|,|\\s]+)\\s+([\\w|_]+)\\s*${suffix}`);
    const charArrayRegex = new RegExp(`char\\s+([\\w|_]+)\\s*\\[`);
    const pointerRegex = new RegExp(`([\\w|:|<|>|,|\\s]+)\\s*\\*\\s*([\\w|_]+)\\s*${suffix}`);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.indexOf("{") >= 0) {
        bracketsCount++;
      }
      if (line.indexOf("}") >= 0) {
        bracketsCount--;
      }
      if (bracketsCount >= 2) {
        // 进到内部方法
        continue;
      }
      let matches = line.match(objectRegex);
      if (matches) {
        fields.push(new Field("object", matches[2]));
        continue;
      }
      matches = line.match(charArrayRegex);
      if (matches) {
        fields.push(new Field("char[]", matches[1]));
        continue;
      }
      matches = line.match(pointerRegex);
      if (matches) {
        fields.push(new Field("pointer", matches[2]));
        continue;
      }
      if (line.indexOf('#ifdef') >= 0) {
        fields.push(new Field("#ifdef", line));
        continue;
      }
      if (line.indexOf('#endif') >= 0) {
        fields.push(new Field("#endif", line));
      }
    }
    return fields;
  }

  private getClassHeaders(headers: string[], classCode: string, filePath: string, headerGuard?: string) {
    if (classCode.indexOf('list<') >= 0) {
      headers.push('<list>');
    }
    if (classCode.indexOf('map<') >= 0) {
      headers.push('<map>');
    }
    if (classCode.indexOf('_ptr') >= 0) {
      headers.push('<memory>');
    }
    if (classCode.indexOf('queue<') >= 0) {
      headers.push('<queue>');
    }
    if (classCode.indexOf('string') >= 0) {
      headers.push('<string>');
    }
    if (classCode.indexOf('unordered_map<') >= 0) {
      headers.push('<unordered_map>');
    }
    if (classCode.indexOf('vector<') >= 0) {
      headers.push('<vector>');
    }
    if (headerGuard) {
      const headerInclude = this.toHeaderInclude(headerGuard);
      headers.push(`"${headerInclude}"`);
    }
  }

  private wrapNamespace(code: string, namespace?: string): string {
    if (!namespace) {
      return code;
    }
    return `namespace ${namespace} {\n\n${code}\n\n}  // namespace ${namespace}`;
  }

  private mergeCode(headers: string[], code: string, namespace?: string) {
    return `${headers.map(it => '#include ' + it).join('\n')}\n\n${this.wrapNamespace(code, namespace)}`;
  }

  private parseClassName(code: string, tag: string): string | undefined {
    const i1 = code.indexOf(tag);
    if (i1 < 0) {
      return undefined;
    }
    let i2 = code.indexOf(':', i1 + tag.length);
    if (i2 < 0) {
      i2 = code.indexOf('{', i1 + tag.length);
    }
    if (i2 < 0) {
      return undefined;
    }
    return code.substring(i1 + tag.length, i2).trim();
  }

  private toHeaderInclude(headerGuard: string): string {
    return headerGuard.replace('_H_', '.h').replace(/_/g, '/').toLowerCase();
  }

  private parseCode(code: string, startTag: string, startLine: number) {
    let resultCode: Code = { code: undefined, namespace: undefined, headerGuard: undefined };
    let classCode = '';
    const lines = code.split('\n');
    let namespace = undefined;
    const namespaceTag = 'namespace ';
    const headerGuardTag = '_H_';
    let headerGuard = undefined;
    let bracketsCount = 0;
    let enterClassBrackets = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i < startLine) {
        if (!namespace) {
          const iNamespace1 = line.indexOf(namespaceTag);
          if (iNamespace1 >= 0) {
            const iNamespace2 = line.indexOf("{", iNamespace1 + namespaceTag.length);
            if (iNamespace2 >= 0) {
              namespace = line.substring(iNamespace1 + namespaceTag.length, iNamespace2).trim();
            }
          }
        }
        if (!headerGuard) {
          const iHeaderGuard1 = line.indexOf(headerGuardTag);
          if (iHeaderGuard1 >= 0) {
            const iHeaderGuard2 = line.lastIndexOf(" ", iHeaderGuard1);
            if (iHeaderGuard2 >= 0) {
              headerGuard = line.substring(iHeaderGuard2, iHeaderGuard1).trim() + headerGuardTag;
            }
          }
        }
        continue;
      }
      if (i == startLine) {
        resultCode.className = this.parseClassName(line, startTag);
      }
      if (line.indexOf("{") >= 0) {
        bracketsCount++;
        enterClassBrackets = true;
      }
      if (line.indexOf("}") >= 0) {
        bracketsCount--;
      }
      if (enterClassBrackets && bracketsCount <= 0) {
        classCode += line;
        break;
      }
      classCode += line + '\n';
    }
    resultCode.code = classCode;
    resultCode.namespace = namespace;
    resultCode.headerGuard = headerGuard;
    return resultCode;
  }

  extractEqClass(fullText: string, startTag: string, lineNumber: number): ExtractResult {
    const code = this.parseCode(fullText, startTag, lineNumber);
    if (!code.code || !code.className) {
      return { error: `Failed to parseCode with startTag "${startTag}"` };
    }

    const structName = code.className;
    const fields = this.getFields(code.code);
    const equalDeclare = `bool operator==(const ${structName}& a, const ${structName}& b)`;
    const printDeclare = `void PrintTo(const ${structName}& a, ::std::ostream* os)`;
    let hBody = `${equalDeclare};\n${printDeclare};`;
    let cBody = `${equalDeclare} {\n  return `;
    let firstItem = true;
    cBody += fields.map((it, index) => {
      if (it.type == '#ifdef') {
        return it.name;
      }
      if (it.type == '#endif') {
        if (index == fields.length - 1) {
          return `${it.name}\n      && true`
        }
        return it.name;
      }

      let sep = '';
      if (firstItem) {
        firstItem = false;
      } else {
        sep = '      && ';
      }

      if (it.type == 'char[]') {
        return `${sep}strcmp(a.${it.name}, b.${it.name}) == 0`;
      } else {
        return `${sep}a.${it.name} == b.${it.name}`;
      }
    }).join('\n');
    cBody += ';\n}';
    cBody += `\n${printDeclare} {\n  *os << "{"\n`;
    firstItem = true;
    cBody += fields.map((it) => {
      if (it.type == '#ifdef' || it.type == '#endif') {
        return it.name;
      }
      if (firstItem) {
        firstItem = false;
        return `      << "${it.name}: " << a.${it.name}`;
      }
      return `      << ", ${it.name}: " << a.${it.name}`;
    }).join('\n');
    cBody += '\n      << "}"';
    cBody += ';\n}';
    if (code.namespace) {
      hBody = this.wrapNamespace(hBody, code.namespace);
      cBody = this.wrapNamespace(cBody, code.namespace);
    }
    if (code.headerGuard) {
      const headerInclude = this.toHeaderInclude(code.headerGuard);
      hBody = `#include "${headerInclude}"\n\n${hBody}`;
    }
    hBody = `#include <sstream>\n\n${hBody}`;
    const fileName = structName.replace(/([^\s])([A-Z])/g, "$1_$2").toLowerCase();
    return { data: { fileName, hBody, cBody } };
  }

  extractMockClass(fullText: string, startTag: string, lineNumber: number): ExtractResult {
    const code = this.parseCode(fullText, startTag, lineNumber);
    if (!code.code) {
      return {error: `Failed to parseCode with startTag "${startTag}"`};
    }

    const mock = this.toGmock(code.code);
    if (!mock.code) {
      return {error: `Failed to translate gmock code`};
    }
    if (!mock.origClassName) {
      return {error: `Failed to translate gmock className`};
    }
    const fileName = mock.origClassName.replace(/([^\s])([A-Z])/g, "$1_$2").toLowerCase();
    const hHeaders: string[] = ['<gmock/gmock.h>', '<cstring>'];
    this.getClassHeaders(hHeaders, mock.code, fileName, code.headerGuard);
    const hBody = this.mergeCode(hHeaders, mock.code, code.namespace);

    const constructorImpls = mock.constructors.join('\n');
    const deconstructorImpl = `Mock${mock.origClassName}::~Mock${mock.origClassName}() {}`;
    const cBody = this.wrapNamespace(`${constructorImpls}\n${deconstructorImpl}`, code.namespace);
    return { data: { fileName, hBody, cBody } };
  }

}