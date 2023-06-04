import * as fs from 'fs';
import { regex_commands } from './regex_commands';
import * as cp from 'child_process';
import * as path from 'path';

type command_replace_model = {
    reg_expression: RegExp
    replace_string: string
}

export class class_creator
{
    header_file_content: string = "";
    source_file_content: string = "";
    unittest_file_content: string = "";
    class_name: string = "";
    create_location: string = "";
    header_file: string = "";
    source_file: string = "";
    unittest_file: string = "";
    workspace: string = "";
    gens_class: boolean = true;
    gens_unittest: boolean = false;

    constructor(type: number, workspace: string, class_name: string, header_preset: string, source_file_preset: string, create_location: string, source_file_name: string, header_file_name: string, unittest_file_name: string) 
    {
        this.gens_class = (type & 1) != 0;
        this.gens_unittest = (type & 2) != 0;
        this.workspace = workspace;
        this.class_name = class_name;
        this.header_file_content = header_preset || "//\n\
// Created by ${USER} on ${DATE}.\n\
// Copyright (c) ${YEAR} ${COMPANY}. All rights reserved.\n\
//\n\
\n\
#ifndef ${HEADER_GUARD}\n\
#define ${HEADER_GUARD}\n\
\n\
#include <string>\n\
\n\
namespace ${NAMESPACE} {\n\
\n\
class ${CLASSNAME_CAMEL} {\n\
 public:\n\
  \n\
 private:\n\
\n};\
\n\
\n}  // namespace ${NAMESPACE}\
\n\
\n#endif  // ${HEADER_GUARD}\n";
        this.source_file_content = source_file_preset || "//\n\
// Created by ${USER} on ${DATE}.\n\
// Copyright (c) ${YEAR} ${COMPANY}. All rights reserved.\n\
//\n\
\n\
#include ${HEADER_INCLUDE}\n\
\n\
namespace ${NAMESPACE} {\n\
\n\
\n\
\n}  // namespace ${NAMESPACE}\
\n";
        this.unittest_file_content = "//\n\
// Created by ${USER} on ${DATE}.\n\
// Copyright (c) ${YEAR} ${COMPANY}. All rights reserved.\n\
//\n\
\n\
#include <gtest/gtest.h>\n\
#include <${MODULE}/${MODULE}.h>\n\
\n\
namespace ${NAMESPACE} {\n\
\n\
TEST(${CLASSNAME_CAMEL}Tests, test_any) {\n\
  ASSERT_EQ(1, 1);\n\
}\n\
\n\
}  // namespace ${NAMESPACE}\n\
";
        this.create_location = create_location;
        this.header_file = header_file_name || "${CLASSNAME}.h";
        this.source_file = source_file_name || "${CLASSNAME}.cc";
        this.unittest_file = unittest_file_name || "${CLASSNAME}_unittest.cc";
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
        var upper_regex             : RegExp = /\${CLASSNAMEUPPER}/gi;
        var lower_regex             : RegExp = /\${CLASSNAMELOWER}/gi;
        var cap_regex               : RegExp = /\${CLASSNAME_CAMEL}/gi;
        var default_regex           : RegExp = /\${CLASSNAME}/gi;
        var headerfilename_regex    : RegExp = /\${HEADERFILENAME}/gi;
        var sourcefilename_regex    : RegExp = /\${SOURCEFILENAME}/gi;
        var user_regex              : RegExp = /\${USER}/gi;
        var company_regex           : RegExp = /\${COMPANY}/gi;
        var year_regex              : RegExp = /\${YEAR}/gi;
        var date_regex              : RegExp = /\${DATE}/gi;
        var header_guard_regex      : RegExp = /\${HEADER_GUARD}/gi;
        var header_include_regex    : RegExp = /\${HEADER_INCLUDE}/gi;
        var module_regex            : RegExp = /\${MODULE}/gi;
        var namespace_regex            : RegExp = /\${NAMESPACE}/gi;

        const date = new Date();
        const git_dir = await this.exec(`git -C "${this.create_location}" rev-parse --show-toplevel`);
        const user = await this.exec(`git -C "${this.create_location}" config --get user.name`);
        const company = await this.exec(`git -C "${this.create_location}" config --get user.company`);
        const root_dir = git_dir || this.workspace;
        const cppmodule_file = path.join(root_dir, 'cppmodule.json');
        let module: string | undefined;
        let namespace: string | undefined;
        if (fs.existsSync(cppmodule_file)) {
            const data = JSON.parse(fs.readFileSync(cppmodule_file).toString());
            module = data.module;
            namespace = data.namespace;
        }

        const file_cmds: Array<command_replace_model> = [
            { reg_expression: upper_regex, replace_string: regex_commands.upper_case(this.class_name)},// CLASSNAMEUPPER - default classname to upper
            { reg_expression: lower_regex, replace_string: regex_commands.lower_case(this.class_name)},// CLASSNAMELOWER - default classname to lower
            { reg_expression: cap_regex, replace_string: regex_commands.capitalize(this.class_name)},  // CLASSNAMECAPI  - default classname with capitalized first letter
            { reg_expression: default_regex, replace_string: regex_commands.default(this.class_name)}, // CLASSNAME      - default classname
        ]

        this.source_file = this.execute_replacement(file_cmds, this.source_file);
        this.header_file = this.execute_replacement(file_cmds, this.header_file);
        this.unittest_file = this.execute_replacement(file_cmds, this.unittest_file);

        const content_cmds: Array<command_replace_model> = [
            { reg_expression: headerfilename_regex, replace_string: regex_commands.header_file(this.header_file)}, // HEADERFILENAME - default headerfilename as entered in settings
            { reg_expression: sourcefilename_regex, replace_string: regex_commands.source_file(this.source_file)}, // SOURCEFILENAME - default sourcefilename as entered in settings
            { reg_expression: upper_regex, replace_string: regex_commands.upper_case(this.class_name)},      // CLASSNAMEUPPER - default classname to upper
            { reg_expression: lower_regex, replace_string: regex_commands.lower_case(this.class_name)},      // CLASSNAMELOWER - default classname to lower
            { reg_expression: cap_regex, replace_string: regex_commands.capitalize(this.class_name)},        // CLASSNAMECAPI  - default classname with capitalized first letter
            { reg_expression: default_regex, replace_string: regex_commands.default(this.class_name)},       // CLASSNAME      - default classname
            { reg_expression: year_regex, replace_string: regex_commands.year(date)},
            { reg_expression: date_regex, replace_string: regex_commands.date(date)},
            { reg_expression: user_regex, replace_string: regex_commands.user(user)},
            { reg_expression: company_regex, replace_string: regex_commands.company(company)},
            { reg_expression: header_guard_regex, replace_string: regex_commands.header_guard(root_dir, this.create_location, this.header_file)},
            { reg_expression: header_include_regex, replace_string: regex_commands.header_include(root_dir, this.create_location, this.header_file)},
            { reg_expression: module_regex, replace_string: regex_commands.module(root_dir, module)},
            { reg_expression: namespace_regex, replace_string: regex_commands.namespace(root_dir, namespace)},
        ]

        if (this.gens_class) {
            this.header_file_content = this.execute_replacement(content_cmds, this.header_file_content);
            this.source_file_content = this.execute_replacement(content_cmds, this.source_file_content);
        }
        if (this.gens_unittest) {
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