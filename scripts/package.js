//
// Created by Galen Lin on 2023/12/26.
//
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function abort(message) {
  console.log('');
  console.error(`[!] ${message}`);
  process.exit(1);
}

function printOk(message) {
  console.log(`\x1b[32m✓\x1b[0m ${message}`);
}

function loadConfig() {
  const cwd = process.cwd();
  const configFile = path.join(cwd, 'package.json');
  const configString = fs.readFileSync(configFile);
  return JSON.parse(configString);
}


function main(argv) {
  // 获取下个版本号
  const config = loadConfig();
  execSync('vsce package', {encoding: 'utf-8'});
  const vsixFile = `${config.name}-${config.version}.vsix`;
  if (!fs.existsSync(vsixFile)) {
    abort('Build failed.');
  }
  printOk(`Generated ${vsixFile}`);
  execSync(`code --install-extension ${config.name}-${config.version}.vsix`);
  printOk(`Installed ${vsixFile}`);
}

main(process.argv.slice(2));
