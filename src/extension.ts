// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { class_creator } from './class_creator';
import { vscode_helper } from "./vscode_helper";
import { dir_helper } from "./dir_helper";
import { template_helper } from './template_helper';
import { GmockHelper } from './gmock_helper';
import { gmockStyleFromStr } from './conversions';

const template = new template_helper();
let kConfig: any = {};

function makeGmock(): GmockHelper {
  var config = vscode.workspace.getConfiguration('filegen');

  var gmockStyleStr = config.get('gmockStyle');
  if(gmockStyleStr === undefined) {
    throw Error('Coudln\'t find config filegen.gmockStyle');
  }

  var gmockStyle = gmockStyleFromStr(gmockStyleStr as string);

  return new GmockHelper(gmockStyle);
}

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
  const root = vscode_helper.workspace() || "";
  var creator = new class_creator(type, root, className, template,
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
 
  const out = creator.create_files();
  if (out) {
    vscode.window.showInformationMessage(`FileGen: ${out.join('|')} created.`);
    vscode.workspace.openTextDocument(path.join(location, out[0]))
      .then(doc => vscode.window.showTextDocument(doc));
  } else {
    vscode.window.showErrorMessage(`FileGen: failed to create files for "${className}".`);
  }
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
      const gmock = makeGmock();
      editor.edit(eb => {
        // 文本替换
        const mock = gmock.toGmock(word);
        eb.replace(selection, mock.code || word);
      });
    }
  }
}

async function handleExtractGmockEq(root: string, args: any) {
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
  const curFileName = path.basename(doc.uri.fsPath);
  const gmock = makeGmock();
  const result = gmock.extractEqClass(fullText, startTag, lineNumber, curFileName);
  if (!result.data) {
    vscode.window.showErrorMessage(`FileGen: ${result.error}.`);
    return;
  }
  const {fileName, hBody, cBody} = result.data;

  const baseDir = kConfig.gmock?.eqFilePath || "test/test/compare";
  const filePrefix = kConfig.gmock?.eqFilePrefix || "eq_";
  const toDir = path.join(root, baseDir);
  const creator = await makeClassGenerator(1, fileName, toDir, {
    FILEPREFIX: filePrefix,
    FILESUFFIX: '',
    H_BODY: hBody,
    CC_BODY: cBody,
  });
  const out = creator.create_files();
  if (out) {
    vscode.window.showInformationMessage(`FileGen: ${out.join(', ')} created.`);
    vscode.workspace.openTextDocument(path.join(toDir, out[0]))
      .then(doc => vscode.window.showTextDocument(doc));
  } else {
    vscode.window.showErrorMessage(`FileGen: failed to extract operator== class.`);
  }
}

async function handleExtractGmockClass(root: string, args: any) {
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
  // let f = doc.fileName;
  const fullText = doc.getText();
  const curFileName = path.basename(doc.uri.fsPath);
  const gmock = makeGmock();
  const result = gmock.extractMockClass(fullText, startTag, lineNumber, curFileName);
  if (!result.data) {
    vscode.window.showErrorMessage(`FileGen: ${result.error}.`);
    return;
  }
  const {fileName, hBody, cBody} = result.data;
  const baseDir = kConfig.gmock?.mockFilePath || "test/test/mock";
  const filePrefix = kConfig.gmock?.mockFilePrefix || "mock_";
  const toDir = path.join(root, baseDir);
  const creator = await makeClassGenerator(1, fileName, toDir, {
    FILEPREFIX: filePrefix,
    FILESUFFIX: '',
    H_BODY: hBody,
    CC_BODY: cBody,
  });
  const out = creator.create_files();
  if (out) {
    vscode.window.showInformationMessage(`FileGen: ${out.join(', ')} created.`);
    vscode.workspace.openTextDocument(path.join(toDir, out[0]))
      .then(doc => vscode.window.showTextDocument(doc));
  } else {
    vscode.window.showErrorMessage(`FileGen: failed to extract gmock class.`);
  }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  const root = vscode_helper.workspace() || "";
  template.init_templates(path.join(root, 'filegen'));
  kConfig = await class_creator.loadConfig(root) || {}
  const configWatcher = vscode.workspace.createFileSystemWatcher({
    base: root,
    pattern: 'filegen.json'
  }, true, false, false);
  configWatcher.onDidChange(async _e => {
    const config = await class_creator.loadConfig(root);
    if (config) {
      kConfig = config;
    }
  });
  configWatcher.onDidDelete(_e => kConfig = {});
  const templateWatcher = vscode.workspace.createFileSystemWatcher({
    base: root,
    pattern: 'filegen/*'
  }, true, false, false);
  templateWatcher.onDidChange(uri => template.removeCache(path.basename(uri.fsPath)));
  templateWatcher.onDidDelete(uri => template.removeCache(path.basename(uri.fsPath)));

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
    handleExtractGmockEq(root, args);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('extension.extractGmockClass', async (args) => {
    // The code you place here will be executed every time your command is executed
    handleExtractGmockClass(root, args);
  }));
}

// this method is called when your extension is deactivated
export function deactivate() {}
