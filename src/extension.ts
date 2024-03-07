// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { class_creator } from './class_creator';
import { vscode_helper } from "./vscode_helper";
import { dir_helper } from "./dir_helper";
import { template_helper } from './template_helper';

const template = new template_helper();

async function handleCommand(type: number, args: any) {
	var res = await vscode_helper.create_name_input();
	if(!vscode_helper.can_continue(res)) return; // check for class name

	let dir_config :string | undefined | boolean= vscode.workspace.getConfiguration().get("cpp.creator.setPath");
	let dir_h = new dir_helper(dir_config, args);

	await dir_h.check_context_menu();
	await dir_h.check_boolean_null(res);

	var header_file_name     = "${FILENAME}.h";
	var source_file_name     = "${FILENAME}.cc";
	var unittest_file_name   = "${FILENAME}_unittest.cc"
	var header_preset        = await template.get_template(header_file_name);
	var source_file_preset   = await template.get_template(source_file_name);
	var unittest_file_preset = await template.get_template(unittest_file_name);
	const root = vscode_helper.workspace() || "";
	var creator = new class_creator(type, root, res as string, template, header_preset, source_file_preset, unittest_file_preset, dir_h.dir(), source_file_name, header_file_name, unittest_file_name)
	await creator.parse()
				
	var out = creator.create_files(); // if setPath was neither false, null or true, it was a ststring, so maybe a valid path? 
															//Create the class there
	if (out)
	{
		vscode.window.showInformationMessage('Your Class ' + res + '  has been created! \n(@'+dir_h.dir()+')');
	}
	else
	{
		vscode.window.showErrorMessage('Your Class ' + res + '  has been not created! \n(@'+dir_h.dir()+')');
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
	// 	int b,
	// 	std::unique_ptr<char> c,
	// 	char *d);
	// virtual std::unique_ptr<char> Hello2(int a,
	// 	int b,
	// 	std::unique_ptr<char> c,
	// 	char *d);
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

function toGmockClass(text: string): string {
	// class Application : public a
	//									 , public b {
	// -->
	// class MockApplication : public Application {
	// 去除宏定义
	text = text.replace(/class [A-Z|_]+\s+([\w|_])/, "class $1");
	const classTag = "class ";
	const index = text.indexOf(classTag);
	if (index < 0) {
		return text;
	}
	const index2 = text.indexOf("{", index + classTag.length);
	if (index2 < 0) {
		return text;
	}
	const head = text.substring(0, index);
	const tail = text.substring(index2 + 1);
	let index3 = text.indexOf(":", index + classTag.length);
	if (index3 < 0) {
		index3 = index2;
	}
	const className = text.substring(index + classTag.length - 1, index3).trim();
	return `${head}class Mock${className} : public ${className} {${tail}`;
}

function toGmock(text: string): string {
	let isVirtualStart = false;
	let isVirtualEnd = false;
	let virtualCode = '';
	let fullCode = '';
	let classCode = '';
	let isClassStart = false;
	let isClassEnd = false;
	let isNotPublicStart = false;
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
		if (line.indexOf('class ') >= 0) {
			isClassStart = true;
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
		
		if (!isVirtualStart && !isClassStart) {
			fullCode += line + lineSep;
		}

		if (isClassEnd) {
			// class 替换为 mock
			fullCode += toGmockClass(classCode);
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
	return fullCode;
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
				eb.replace(selection, toGmock(word));
			});
		}
	}
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	template.init_templates(context.globalStoragePath);

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
}

// this method is called when your extension is deactivated
export function deactivate() {}
