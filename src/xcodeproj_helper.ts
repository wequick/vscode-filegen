// class to run ruby xcodeproj

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface PathInfo {
    xcodeproj_path: string
    file_paths: string[]
}

export default class xcodeproj_helper {
    scripts_root: string
    constructor(scripts_root: string) {
        this.scripts_root = scripts_root;
    }

    run_ruby(script_name: string, command: string) {
        let cmd = `ruby ${this.scripts_root}/xcodeproj/${script_name}.rb ${command}`;
        console.log(cmd);
        let result = execSync(cmd);
        console.log(result.toString());
    }

    add_files(file_paths: string[]) {
        const path_infos = this._group_xcodeproj_path_infos(file_paths);
        // run ruby for each xcodeproj path
        path_infos.forEach(path_info => {
            let quote_paths = path_info.file_paths.map(file_path => `"${file_path}"`).join(' ');
            this.run_ruby('add_file', `"${path_info.xcodeproj_path}" ${quote_paths}`);
        });
    }

    remove_files(file_paths: string[]) {
        const path_infos = this._group_xcodeproj_path_infos(file_paths);
        // run ruby for each xcodeproj path
        path_infos.forEach(path_info => {
            let quote_paths = path_info.file_paths.map(file_path => `"${file_path}"`).join(' ');
            this.run_ruby('remove_file', `"${path_info.xcodeproj_path}" ${quote_paths}`);
        });
    }

    private _group_xcodeproj_path_infos(file_paths: string[]) {
        let path_infos: PathInfo[] = []
        // find xcodeproj path, fill into path_infos
        file_paths.forEach(file_path => {
            let file_dir = this._get_dir(file_path);
            let xcodeproj_path = this._find_project_dir(file_dir);
            if (!xcodeproj_path) {
                console.log(`${xcodeproj_path} not found`)
                return;
            }
            let path_info = path_infos.find(path_info => path_info.xcodeproj_path == xcodeproj_path);
            if (!path_info) {
                path_info = {
                    xcodeproj_path: xcodeproj_path,
                    file_paths: []
                }
                path_infos.push(path_info);
            }
            path_info.file_paths.push(file_path);
        });
        return path_infos;
    }

    private _get_dir(file_path: string) {
        // if file_path is a directory return
        if (fs.statSync(file_path).isDirectory()) {
            return file_path;
        }
        // return parent directory
        return path.resolve(path.join(file_path, '..'));
    }

    private _find_project_dir(dir: string) : string | undefined {
        if (!fs.existsSync(dir)) {
            console.log(`${dir} not found`)
            return undefined;
        }
        // 查找 .xcodeproj 目录
        let project_dir = this._find_dir_with_suffix(dir, '.xcodeproj');
        if (project_dir) {
            return project_dir;
        }
        const parent_dir = path.join(dir, '..');
        if (parent_dir == dir) {
            return undefined;
        }
        return this._find_project_dir(parent_dir);
    }

    private _find_dir_with_suffix(root: string, suffix: string) {
        let dirs = fs.readdirSync(root);
        for (let i = 0; i < dirs.length; i++) {
            let dir = dirs[i];
            let full_path = path.join(root, dir);
            if (fs.statSync(full_path).isDirectory()) {
                if (dir.endsWith(suffix)) {
                    return full_path;
                }
            }
        }
        return undefined;
    }
}