import * as vscode from 'vscode';

export abstract class vscode_helper
{
    public static async create_name_input() : Promise <string | undefined>
    {
    var option: vscode.InputBoxOptions = {
        ignoreFocusOut: false,
        placeHolder: "foo it in the bar.",
        prompt: "Type your class name"
    };
    return vscode.window.showInputBox(option);
    }

    public static async create_path_input() : Promise<string | undefined>
    {
    var option: vscode.InputBoxOptions = {
        ignoreFocusOut: false,
        placeHolder: "Give me your path.",
        prompt: "Type a valid path"
    };
    return await vscode.window.showInputBox(option);
    }

    public static can_continue(res: any)
    {
        if (!res)
        {
            vscode.window.showErrorMessage("Your Class could not be created!");
            return false;
        }
        else if (res.length > 60)
        {
            vscode.window.showErrorMessage("Class name to long!");
            return false;
        }
        else if (res.indexOf(' ') >= 0)
        {
            vscode.window.showErrorMessage("Class name should not have spaces!");
            return false;
        }
        return true;
    }
    public static check_dirname(dirname: string | undefined): boolean {
        if (!dirname) {
            vscode.window.showErrorMessage("dirname is empty!");
            return false;
        }
        // check if dirname is a valid path in macOS and windows, excludes special chars
        if (dirname.match(/[^a-zA-Z0-9_\-\.\/]/)) {
            vscode.window.showErrorMessage("dirname is not a valid path!");
            return false;
        }
        return true;
    }
    public static workspace(): string | undefined {
        let wfs = vscode.workspace.workspaceFolders;
        if (wfs) {
            return wfs[0].uri.fsPath;
        }
        return undefined;
    }
}