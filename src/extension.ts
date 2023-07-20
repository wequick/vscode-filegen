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
}

// this method is called when your extension is deactivated
export function deactivate() {}
