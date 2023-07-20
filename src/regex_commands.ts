import * as path from 'path';

export abstract class regex_commands
{
    static module(root_dir: string|undefined, module_name: string | undefined): string {
        if (module_name) {
            return module_name;
        }
        if (root_dir) {
            const proj_name = path.basename(root_dir);
            const arr = proj_name.split('_');
            if (arr.length <= 1) {
                return proj_name;
            }
            let s = '';
            for (let index = 0; index < arr.length; index++) {
                const e = arr[index];
                if (e.length <= 3) {
                    s += e;
                } else {
                    s += e.substring(0, 3);
                }
            }
            return s;
        }
        return '';
    }
    static namespace(root_dir: string|undefined, namespace: string | undefined): string {
        return this.module(root_dir, namespace).replace(/-/g, '_');
    }
    static module_include(module: string | undefined): string {
        if (module && module != '') {
            return '#include <' + module + '/' + module + '.h>\n'
        }
        return ''
    }
    static header_path(root_dir: string, create_location: string, header_file: string): string {
        let folder;
        let i = create_location.indexOf(root_dir);
        if (i >= 0) {
            folder = path.relative(root_dir, create_location);
        } else {
            folder = path.dirname(create_location);
        }
        // src/main/cpp/webrtc/src/adapter => adapter
        folder = folder.replace(/\\/g, '/');
        folder = folder.replace(/-/g, '_');
        const src_root_dirs = ['src/', 'cpp/']
        for (let index = 0; index < src_root_dirs.length; index++) {
            const element = src_root_dirs[index];
            i = folder.lastIndexOf(element);
            if (i >= 0) {
                folder = folder.substring(i + element.length);
            }
        }
        return folder + "/" + header_file;
    }
    static header_include(root_dir: string, create_location: string, header_file: string): string {
        return "\"" + this.header_path(root_dir, create_location, header_file) + "\"";
    }
    static header_guard(root_dir: string, create_location: string, header_file: string): string {
        let s = this.header_path(root_dir, create_location, header_file);
        s = s.replace(".h", "_H_").replace(/\//g, "_").toUpperCase();
        return s;
    }
    static organization(cp: string|undefined): string {
        return cp || "Unknown";
    }
    static user(user: string|undefined): string {
        return user || "Unknown";
    }
    static date(date: Date): string {
        let s: string = "";
        s += date.getFullYear();
        s += "/";
        const m = date.getMonth() + 1;
        if (m >= 10) {
            s += m;
        } else {
            s += "0" + m;
        }
        s += "/";
        const d = date.getDate();
        if (d >= 10) {
            s += d;
        } else {
            s += "0" + d;
        }
        return s;
    }
    static year(date: Date): string {
        return date.getFullYear().toString();
    }
    public static default(str: string) : string
    {
        return str;
    }
    
    public static lower_case(str: string) : string
    {
        return str.toLowerCase();
    }

    public static upper_case(str: string) : string
    {
        return str.toUpperCase();
    }

    public static camel(str: string) : string
    {
        let name = str[0].toUpperCase() + str.substring(1);
        return name.replace(/\_(\w)/g, function(all, letter){
            return letter.toUpperCase();
        });
    }

    public static header_file(h_file: string) : string
    {
        return h_file;
    }

    public static source_file(s_file: string) : string
    {
        return s_file;
    }
}