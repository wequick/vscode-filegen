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

function writeConfigVersion(config, versionStr) {
  const cwd = process.cwd();
  const configFile = path.join(cwd, 'package.json');
  config.version = versionStr;
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), {encoding: 'utf-8'});
}

class Section {
  constructor(name) {
    this.name = name;
    this.items = {};
    this.typeTitles = {
      feat: 'Features',
      fix: 'Bug Fixes',
      refactor: 'Refactors',
    }
  }
  addItem(type, item) {
    type = this.typeTitles[type] || type;
    if (type in this.items) {
      this.items[type].push(item);
    } else {
      this.items[type] = [item];
    }
  }
  getTypes() {
    return Object.keys(this.items).sort();
  }
  getItems(type) {
    return this.items[type] || [];
  }
}

class Changelog {
  constructor(codeUrlBase, issueUrlBase, firstSection) {
    this.setions = [];
    this.codeUrlBase = codeUrlBase;
    this.issueUrlBase = issueUrlBase;
    this.addSection(firstSection);
  }
  addSection(section) {
    this.setions.push(new Section(section));
  }
  addItem(type, item) {
    const section = this.setions[this.setions.length - 1];
    section.addItem(type, item);
  }
  addIssueLink(msg) {
    return msg.replace(/#(\d+)/g, (match, issueNumber) => {
      return `[#${issueNumber}](${this.issueUrlBase}${issueNumber})`;
    });
  }
  addLineIfNeeded(line) {
    let msg = line.trim();
    // Find tags as new section
    let re = msg.match(/^\(.*tag: ([^\s,\)]+)[^\)]*\)(.+)$/);
    if (re) {
      this.addSection(re[1]);
      msg = re[2];
    }
    // Find messages with feat|fix|refactor prefix.
    // e.g. "(HEAD -> master)feat(module): do sth, to #id."
    re = msg.match(/^(\([^\)]+\))?(feat|fix|refactor)(\([^\)]+\))?:\s*(.*)$/);
    if (re) {
      const [_, _branch, type, _module, rawMsg] = re;
      msg = this.addIssueLink(rawMsg);
      this.addItem(type, msg);
    }
  }
  gitLogCmd() {
    return `git log --oneline --pretty="%d%s [%h](${this.codeUrlBase}commit/%h) by %an"`;
  }
  toMarkdown() {
    let markdown = '# Changelog\n';
    markdown += 'All notable changes to this project will be documented in this file.\n\n';
    markdown += 'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\n';
    markdown += 'and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n';
    for (let i = 0; i < this.setions.length; ++i) {
      const section = this.setions[i];
      markdown += `\n## ${section.name}\n`;
      if (i + 1 < this.setions.length) {
        const nextSection = this.setions[i + 1];
        markdown += `\n<small>[Compare with ${nextSection.name}](${this.codeUrlBase}compare/${nextSection.name}...${section.name})</small>\n`;
      }
      for (let type of section.getTypes()) {
        markdown += `\n### ${type}\n`;
        for (let item of section.getItems(type)) {
          markdown += `- ${item}\n`;
        }
      }
    }
    return markdown;
  }
}

class Version {
  constructor(version) {
    this.major = 0;
    this.minor = 0;
    this.patch = 0;
    this.build = 0;
    this.parseVersion(version);
  }
  parseVersion(version) {
    const arr = version.split('.');
    if (arr.length !== 3 && arr.length !== 4) {
      this.major = 0;
      return;
    }
    this.major = parseInt(arr[0]);
    this.minor = parseInt(arr[1]);
    this.patch = parseInt(arr[2]);
    if (arr.length === 4) {
      this.build = parseInt(arr[3]);
    }
  }
  isValid() {
    return this.major > 0;
  }
  toString() {
    return `${this.major}.${this.minor}.${this.patch}${this.build > 0 ? `.${this.build}` : ''}`;
  }
}

function hookOnVersionChange(_versionStr) {
  return false;
}

function main(argv) {
  // get next version
  let nextVersion = argv[0];
  const config = loadConfig();
  const version = new Version(config.version);
  if (!version.isValid()) {
    abort('Invalid version: ' + config.version);
  }
  printOk(`current verion: ${config.version}`);
  if (!nextVersion) {
    nextVersion = `${version.major}.${version.minor + 1}.${version.patch}`;
  } else if (nextVersion === 'patch') {
    nextVersion = `${version.major}.${version.minor}.${version.patch + 1}`;
  }
  printOk(`next version: ${nextVersion}`);
  // Modify package.json version
  writeConfigVersion(config, nextVersion);
  printOk('Update package.json version');
  hookOnVersionChange(nextVersion);
  // Generate changelog
  let projectUrl = execSync(`git remote get-url origin`, {encoding: 'utf-8'}).trim();
  if (projectUrl.startsWith('git')) {
    const matches = projectUrl.match(/^git@([^:]+):(.+)\.git$/);
    if (matches) {
      projectUrl = `https://${matches[1]}/${matches[2]}/`;
    }
  }
  // compat url for company
  projectUrl = projectUrl.replace('gitlab.alibaba-inc.com', 'code.alibaba-inc.com');
  const issueUrlBase = projectUrl.indexOf('alibaba-inc') >= 0? 'https://aone.alibaba-inc.com/' : projectUrl;
  const issurUrl = `${issueUrlBase}issue/`;
  const changelog = new Changelog(projectUrl, issurUrl, nextVersion);
  const logs = execSync(changelog.gitLogCmd(), {encoding: 'utf-8'}).trim();
  logs.split('\n').forEach(line => {
    changelog.addLineIfNeeded(line);
  });
  const markdown = changelog.toMarkdown();
  printOk('Generate changelog');
  // Update CHANGELOG.md
  fs.writeFileSync('CHANGELOG.md', markdown, 'utf-8');
  printOk('Update CHANGELOG.md');
}

main(process.argv.slice(2));
