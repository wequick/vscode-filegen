import * as fs from 'fs';
import { regex_commands } from './regex_commands';
import * as cp from 'child_process';
import * as path from 'path';
import { template_helper } from './template_helper';

type command_replace_model = {
    reg_expression: RegExp
    replace_string: string
}

export class class_creator
{
    header_file_content: string = "";
    source_file_content: string = "";
    unittest_file_content: string = "";
    file_name: string = "";
    class_name: string = "";
    create_location: string = "";
    header_file: string = "";
    source_file: string = "";
    unittest_file: string = "";
    workspace: string = "";
    gens_class: boolean = true;
    gens_unittest: boolean = false;
    template: template_helper;
    header_template_name: string;
    source_template_name: string;
    unittest_template_name: string;

    constructor(type: number, workspace: string, class_name: string,
        template: template_helper,
        header_preset: string, source_file_preset: string, unittest_file_preset: string,
        create_location: string, source_file_name: string, header_file_name: string, unittest_file_name: string) 
    {
        this.gens_class = (type & 1) != 0;
        this.gens_unittest = (type & 2) != 0;
        this.workspace = workspace;
        this.file_name = class_name;
        this.class_name = class_name;
        this.template = template;
        this.header_file_content = header_preset;
        this.source_file_content = source_file_preset;
        this.unittest_file_content = unittest_file_preset;
        this.create_location = create_location;
        this.header_file = header_file_name;
        this.source_file = source_file_name;
        this.unittest_file = unittest_file_name;
        this.header_template_name = header_file_name;
        this.source_template_name = source_file_name;
        this.unittest_template_name = unittest_file_name;
    }

    exec(cmd: string) : Promise<string|undefined> {
        return new Promise((resolve, reject) => {
            cp.exec(cmd, (err: any, stdout: string, stderr: string) => {
                resolve(err ? undefined : stdout.replace('\n', ''));
            })
        });
    }

    async parse()
    {
        var default_regex           : RegExp = /\${FILENAME}/gi;
        var camel_regex             : RegExp = /\${CLASSNAME}/gi;
        var user_regex              : RegExp = /\${USER}/gi;
        var organization_regex      : RegExp = /\${ORGANIZATION}/gi;
        var year_regex              : RegExp = /\${YEAR}/gi;
        var date_regex              : RegExp = /\${DATE}/gi;
        var header_guard_regex      : RegExp = /\${HEADER_GUARD}/gi;
        var header_path_regex       : RegExp = /\${HEADER_PATH}/gi;
        var module_regex            : RegExp = /\${MODULE_INCLUDE}/gi;
        var namespace_regex         : RegExp = /\${NAMESPACE}/gi;

        const date = new Date();
        const user = await this.exec(`git -C "${this.create_location}" config --get user.name`);
        const config_name = 'filegen.json'
        let module: string | undefined;
        let namespace: string | undefined;
        let organization: string | undefined;
        let config_file = path.join(this.workspace, config_name);
        let root_dir = this.workspace;
        if (!fs.existsSync(config_file)) {
            const git_dir = await this.exec(`git -C "${this.create_location}" rev-parse --show-toplevel`);
            if (git_dir) {
                config_file = path.join(git_dir, config_name)
                root_dir = git_dir;
            }
        }
        if (fs.existsSync(config_file)) {
            const data = JSON.parse(fs.readFileSync(config_file).toString());
            module = data.module;
            namespace = data.namespace;
            organization = data.organization;
        }
        if (!organization) {
            organization = await this.exec(`git -C "${this.create_location}" config --get user.organization`);
            if (!organization || organization == '') {
                const email = await this.exec(`git -C "${this.create_location}" config --get user.email`);
                if (email) {
                    let i = email.indexOf('@')
                    if (i > 0) {
                        let j = email.indexOf('.', i)
                        if (j > 0) {
                            let org = email.substring(i + 1, j)
                            organization = org[0].toUpperCase() + org.substring(1)
                        }
                    }
                }
            }
        }

        const file_cmds: Array<command_replace_model> = [
            { reg_expression: default_regex, replace_string: regex_commands.default(this.file_name)},
        ]

        this.source_file = this.execute_replacement(file_cmds, this.source_file);
        this.header_file = this.execute_replacement(file_cmds, this.header_file);
        this.unittest_file = this.execute_replacement(file_cmds, this.unittest_file);

        const content_cmds: Array<command_replace_model> = [
            { reg_expression: camel_regex, replace_string: regex_commands.camel(this.class_name)},
            { reg_expression: year_regex, replace_string: regex_commands.year(date)},
            { reg_expression: date_regex, replace_string: regex_commands.date(date)},
            { reg_expression: user_regex, replace_string: regex_commands.user(user)},
            { reg_expression: organization_regex, replace_string: regex_commands.organization(organization)},
            { reg_expression: header_guard_regex, replace_string: regex_commands.header_guard(root_dir, this.create_location, this.header_file)},
            { reg_expression: header_path_regex, replace_string: regex_commands.header_path(root_dir, this.create_location, this.header_file)},
            { reg_expression: module_regex, replace_string: regex_commands.module_include(module)},
            { reg_expression: namespace_regex, replace_string: regex_commands.namespace(root_dir, namespace)},
        ]

        const template_path = path.join(root_dir, 'filegen');
        if (this.gens_class) {
            let content = await this.template.get_workspace_template(root_dir, this.header_template_name);
            if (content) {
                this.header_file_content = content;
            }
            this.header_file_content = this.execute_replacement(content_cmds, this.header_file_content);
            content = await this.template.get_workspace_template(root_dir, this.source_template_name);
            if (content) {
                this.source_file_content = content;
            }
            this.source_file_content = this.execute_replacement(content_cmds, this.source_file_content);
        }
        if (this.gens_unittest) {
            const content = await this.template.get_workspace_template(root_dir, this.unittest_template_name);
            if (content) {
                this.unittest_file_content = content;
            }
            this.unittest_file_content = this.execute_replacement(content_cmds, this.unittest_file_content);
        }
    }

    execute_replacement(replacements: Array<command_replace_model>, execute_on: string)
    {
        replacements.forEach(elem => {
            execute_on = execute_on.replace(elem.reg_expression, elem.replace_string)
        });
        return execute_on;
    } 

    create_header_file()
    {
        var hpp_name = this.create_location+"/"+this.header_file;
        fs.writeFile(hpp_name, this.header_file_content, function (err)
        {
            if (err) {
                console.error(err);
                return false;
            }
        });
    
    
        return true;
    }
    create_source_file()
    {
        var cpp_path_and_file_name = this.create_location+"/"+this.source_file;
        fs.writeFile(cpp_path_and_file_name, this.source_file_content, function (err)
        {
            if (err) {
                console.error(err);
                return false;
            }
        });
    
        return true;
    }
    create_unittest_file()
    {
        var cpp_path_and_file_name = this.create_location+"/"+this.unittest_file;
        fs.writeFile(cpp_path_and_file_name, this.unittest_file_content, function (err)
        {
            if (err) {
                console.error(err);
                return false;
            }
        });
    
        return true;
    }
    create_files()
    {
        if (fs.existsSync(this.create_location)) {
            var stats = fs.lstatSync(this.create_location);
    
            if (!stats.isDirectory()) {
                return false; // if the give directory path, isnt a directory, you cant create a class
            }
        }
        else
            fs.mkdirSync(this.create_location); // if the path doesnt exist, just create the directory
    
        let ret = true;
        if (this.gens_class) {
            ret = ret && this.create_header_file();
            ret = ret && this.create_source_file();
        }
        if (this.gens_unittest) {
            ret = ret && this.create_unittest_file();
        }
        return ret;
    }
}