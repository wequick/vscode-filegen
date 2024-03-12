// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { class_creator } from './class_creator';
import { vscode_helper } from "./vscode_helper";
import { dir_helper } from "./dir_helper";
import { template_helper } from './template_helper';

const template = new template_helper();

async function makeClassGenerator(type: number,
    className: string,
    location: string,
    variables?: { [key: string]: string }) {
  let fileName = "${FILENAME}";
  if (variables) {
    fileName = `\${FILEPREFIX}${fileName}\${FILESUFFIX}`;
  }
  var header_file_name     = `${fileName}.h`;
  var source_file_name     = `${fileName}.cc`;
  var unittest_file_name   = "${FILENAME}_unittest.cc"
  var header_preset        = await template.get_template(header_file_name);
  var source_file_preset   = await template.get_template(source_file_name);
  var unittest_file_preset = await template.get_template(unittest_file_name);
  const root = vscode_helper.workspace() || "";
  var creator = new class_creator(type, root, className, template,
      header_preset, source_file_preset, unittest_file_preset,
      location, source_file_name, header_file_name, unittest_file_name,
      variables);
  await creator.parse()
  return creator;
}

async function handleCommand(type: number, args: any) {
  var res = await vscode_helper.create_name_input();
  if(!vscode_helper.can_continue(res)) return; // check for class name

  let dir_config :string | undefined | boolean= vscode.workspace.getConfiguration().get("cpp.creator.setPath");
  let dir_h = new dir_helper(dir_config, args);

  await dir_h.check_context_menu();
  await dir_h.check_boolean_null(res);

  const className = res as string;
  const location = dir_h.dir();

  const creator = await makeClassGenerator(type, className, location);
        
  var out = creator.create_files(); // if setPath was neither false, null or true, it was a ststring, so maybe a valid path? 
                              //Create the class there
  if (out)
  {
    vscode.window.showInformationMessage('Your Class ' + res + '  has been created! \n(@'+location+')');
  }
  else
  {
    vscode.window.showErrorMessage('Your Class ' + res + '  has been not created! \n(@'+location+')');
  }
}

function processArgs(args: string): string {
  const index4 = args.lastIndexOf(")");
  if (index4 > 0) {
    args = args.substring(0, index4 + 1);
  }
  // var = nullptr, var = "", var = 0
  // -->
  // var
  args = args.replace(/\s*=\s*["|\d|\w|\.]+/g, "");
  return args;
}

function getArgsCount(args: string): number {
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

function toGmockFunction(text: string): string {
  // virtual unsigned char * Hello(int a,
  //   int b,
  //   std::unique_ptr<char> c,
  //   char *d);
  // virtual std::unique_ptr<char> Hello2(int a,
  //   int b,
  //   std::unique_ptr<char> c,
  //   char *d);
  const virtualTag = "virtual ";
  const argsStartTag = "(";
  const index = text.indexOf(virtualTag);
  if (index < 0) {
    return text;
  }
  const beforeVirtual = text.substring(0, index);
  const index2 = text.indexOf(argsStartTag, index + virtualTag.length);
  if (index2 < 0) {
    return text;
  }
  const index3 = text.indexOf(";", index2 + argsStartTag.length);
  if (index3 < 0) {
    return text;
  }
  const typeAndFunctionName = text.substring(index + virtualTag.length, index2);
  let args = text.substring(index2, index3);
  const arfterArgs = text.substring(index3 + 1);
  const functionNamePattern = /([\w|_][\w|_|\d]+)$/;
  const functionNameMatch = functionNamePattern.exec(typeAndFunctionName);
  if (functionNameMatch == null) {
    return text;
  }
  const functionName = functionNameMatch[1];
  const returnType = typeAndFunctionName.substring(0, functionNameMatch.index).trim();
  args = processArgs(args);
  const argsCount = getArgsCount(args);
  return `${beforeVirtual}MOCK_METHOD${argsCount}(${functionName}, ${returnType}${args});${arfterArgs}`;
}

function parseClassDeclare(text: string): {[key: string]: string} {
  // class Application : public a
  //                   , public b {
  // -->
  // class MockApplication : public Application {
  // 去除宏定义
  text = text.replace(/class [A-Z|_]+\s+([\w|_])/, "class $1");
  const classTag = "class ";
  const index = text.indexOf(classTag);
  if (index < 0) {
    return {mock: text};
  }
  const index2 = text.indexOf("{", index + classTag.length);
  if (index2 < 0) {
    return {mock: text};
  }
  const head = text.substring(0, index);
  const tail = text.substring(index2 + 1);
  let index3 = text.indexOf(":", index + classTag.length);
  if (index3 < 0) {
    index3 = index2;
  }
  const className = text.substring(index + classTag.length - 1, index3).trim();
  return {head, tail, className, mock: `${head}class Mock${className} : public ${className} {${tail}`};
}

interface ConstructorCode {
  descCode?: string;
  implCode?: string;
}

function toGmockConstructor(code: string, className: string): ConstructorCode {
  let ret: ConstructorCode = {descCode: undefined, implCode: undefined};

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
  const fields = getFields(args, ',', '');
  implCode += fields.map(it => it.name).join(', ');
  implCode += ') {}';
  ret.implCode = implCode;

  return ret;
}

interface Gmock {
  code?: string;
  origClassName?: string;
  constructors: string[];
}

function toGmock(text: string): Gmock {
  let gmock: Gmock = {code: undefined, origClassName: undefined, constructors: []};
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

    if (className && line.indexOf(className + '(') >= 0) {
      isConstructorStart = true;
    }
    if (isConstructorStart) {
      constructorCode += line + lineSep;
      if (line.indexOf(";") >= 0 || line.indexOf("}") >= 0) {
        isConstructorStart = false;
        const gc = toGmockConstructor(constructorCode, className!);
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
      const dec = parseClassDeclare(classCode);
      className = dec.className;
      gmock.origClassName = className;
      fullCode += dec.mock;
      classCode = "";
      isClassEnd = false;
      isClassStart = false;
    }

    if (isVirtualEnd) {
      virtualCode = toGmockFunction(virtualCode);
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

async function handleReplaceGmock(args: any) {
  // 获取编辑器对象
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    // 获取选中文本
    const doc = editor.document;
    const selection = editor.selection;
    const word = doc.getText(selection);
    if (word.indexOf("virtual ") >= 0 || word.indexOf("class ") >= 0) {
      editor.edit(eb => {
        // 文本替换
        const mock = toGmock(word);
        eb.replace(selection, mock.code || word);
      });
    }
  }
}

class Field {
  name: string = '';
  type: string = '';
  constructor(type: string, name: string) {
    this.type = type;
    this.name = name;
  }
}

function getFields(classCode: string, sep: string = '\n', suffix: string = ';'): Field[] {
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

async function handleExtractGmockEq(root: string, config: any, args: any) {
  // 获取编辑器对象
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }
  // 获取选中文本
  const doc = editor.document;
  const lineNumber = editor.selection.active.line;
  const lineText = doc.lineAt(lineNumber).text;
  const startTag = "struct ";
  if (lineText.indexOf(startTag) < 0) {
    return;
  }
  const fullText = doc.getText();
  const code = parseCode(fullText, startTag, lineNumber);
  if (!code.code || !code.className) {
    return;
  }
  
  const structName = code.className;
  const fields = getFields(code.code);
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
      if (index ==  fields.length - 1) {
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
    hBody = wrapNamespace(hBody, code.namespace);
    cBody = wrapNamespace(cBody, code.namespace);
  }
  if (code.headerGuard) {
    const headerFile = path.basename(doc.uri.fsPath);
    const hPath = (code.headerGuard.toLocaleLowerCase() + ".h").replace(headerFile, '').replace(/_/g, '/');
    hBody = `#include "${hPath}${headerFile}"\n\n${hBody}`;
  }
  hBody = `#include <sstream>\n\n${hBody}`;
  const fileName = structName.replace(/([^\s])([A-Z])/g, "$1_$2").toLowerCase();
  const baseDir = config.extractGmockEqPath || "test/test/compare";
  const toDir = path.join(root, baseDir);
  const creator = await makeClassGenerator(1, fileName, toDir, {
    FILEPREFIX: 'eq_',
    FILESUFFIX: '',
    H_BODY: hBody,
    CC_BODY: cBody,
  });
  if (creator.create_files()) {
    vscode.window.showInformationMessage('gmock eq_' + fileName + '  has been created! \n(@'+toDir+')');
  } else {
    vscode.window.showErrorMessage('gmock eq_' + fileName + '  has been not created! \n(@'+toDir+')');
  }
}

function getClassHeaders(headers: string[], classCode: string, filePath: string, headerGuard?: string) {
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
    const headerFile = path.basename(filePath);
    const hPath = (headerGuard.toLocaleLowerCase() + ".h").replace(headerFile, '').replace(/_/g, '/');
    headers.push(`"${hPath}${headerFile}"`);
  }
}

function wrapNamespace(code: string, namespace?: string): string {
  if (!namespace) {
    return code;
  }
  return `namespace ${namespace} {\n\n${code}\n\n}  // namespace ${namespace}`;
}

function mergeCode(headers: string[], code: string, namespace?: string) {
  return `${headers.map(it => '#include ' + it).join('\n')}\n\n${wrapNamespace(code, namespace)}`;
}

function parseClassName(code: string, tag: string): string|undefined {
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

interface Code {
  code?: string;
  namespace?: string;
  headerGuard?: string;
  className?: string;
}

function parseCode(code: string, startTag: string, startLine: number) {
  let resultCode: Code = { code: undefined, namespace: undefined, headerGuard: undefined};
  let classCode = '';
  const lines = code.split('\n');
  let namespace = undefined;
  const namespaceTag = 'namespace ';
  const headerGuardTag = '_H_';
  let headerGuard = undefined;
  let bracketsCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i < startLine) {
      const iNamespace1 = line.indexOf(namespaceTag);
      if (iNamespace1 >= 0) {
        const iNamespace2 = line.indexOf("{", iNamespace1 + namespaceTag.length);
        if (iNamespace2 >= 0) {
          namespace = line.substring(iNamespace1 + namespaceTag.length, iNamespace2).trim();
        }
      }
      const iHeaderGuard1 = line.indexOf(headerGuardTag);
      if (iHeaderGuard1 >= 0) {
        const iHeaderGuard2 = line.lastIndexOf(" ", iHeaderGuard1);
        if (iHeaderGuard2 >= 0) {
          headerGuard = line.substring(iHeaderGuard2, iHeaderGuard1).trim();
        }
      }
      continue;
    }
    if (i == startLine) {
      resultCode.className = parseClassName(line, startTag);
    }
    if (line.indexOf("{") >= 0) {
      bracketsCount++;
    }
    if (line.indexOf("}") >= 0) {
      bracketsCount--;
    }
    if (bracketsCount <= 0) {
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

async function handleExtractGmockClass(root: string, config: any, args: any) {
  // 获取编辑器对象
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return
  }
  // 获取选中文本
  const doc = editor.document;
  const lineNumber = editor.selection.active.line;
  const lineText = doc.lineAt(lineNumber).text;
  const startTag = 'class ';
  if (lineText.indexOf(startTag)) {
    return;
  }
  const baseDir = config.extractGmockClassPath || "test/test/mock";
  // let f = doc.fileName;
  const fullText = doc.getText();
  const code = parseCode(fullText, startTag, lineNumber);
  if (!code.code) {
    return;
  }

  const mock = toGmock(code.code);
  if (!mock.code || !mock.origClassName) {
    return;
  }
  const fileName = mock.origClassName.replace(/([^\s])([A-Z])/g, "$1_$2").toLowerCase();
  const hHeaders: string[] = ['<gmock/gmock.h>', '<cstring>'];
  getClassHeaders(hHeaders, mock.code, fileName, code.headerGuard);
  const hBody = mergeCode(hHeaders, mock.code, code.namespace);

  const constructorImpls = mock.constructors.join('\n');
  const deconstructorImpl = `Mock${mock.origClassName}::~Mock${mock.origClassName}() {}`;
  const cBody = wrapNamespace(`${constructorImpls}\n${deconstructorImpl}`, code.namespace);
  const toDir = path.join(root, baseDir);
  const creator = await makeClassGenerator(1, fileName, toDir, {
    FILEPREFIX: 'mock_',
    FILESUFFIX: '',
    H_BODY: hBody,
    CC_BODY: cBody,
  });
  if (creator.create_files()) {
    vscode.window.showInformationMessage('gmock mock_' + fileName + '  has been created! \n(@'+toDir+')');
  } else {
    vscode.window.showErrorMessage('gmock mock_' + fileName + '  has been not created! \n(@'+toDir+')');
  }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  template.init_templates(context.globalStoragePath);

  const root = vscode_helper.workspace() || "";
  const config = await class_creator.loadConfig(root);

  context.subscriptions.push(vscode.commands.registerCommand('extension.createClassAndUnitTest', async (args) => {
    // The code you place here will be executed every time your command is executed
    handleCommand(3, args);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('extension.createClass', async (args) => {
    // The code you place here will be executed every time your command is executed
    handleCommand(1, args);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('extension.createUnitTest', async (args) => {
    // The code you place here will be executed every time your command is executed
    handleCommand(2, args);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('extension.replaceGmock', async (args) => {
    // The code you place here will be executed every time your command is executed
    handleReplaceGmock(args);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('extension.extractGmockEq', async (args) => {
    // The code you place here will be executed every time your command is executed
    handleExtractGmockEq(root, config, args);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('extension.extractGmockClass', async (args) => {
    // The code you place here will be executed every time your command is executed
    handleExtractGmockClass(root, config, args);
  }));
}

// this method is called when your extension is deactivated
export function deactivate() {}
