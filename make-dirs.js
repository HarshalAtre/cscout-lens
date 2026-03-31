#!/usr/bin/env node
// Run this with: node make-dirs.js
// Then all the directories will exist for file creation

const fs = require('fs');
const path = require('path');

const baseDir = __dirname;

const dirs = [
    'sample',
    'sample/calc',
    'src/db',
    'src/scripts',
    'src/services',
    'src/webview',
    'src/test',
    'resources'
];

console.log('Creating directories in:', baseDir);
console.log('');

for (const dir of dirs) {
    const fullPath = path.join(baseDir, dir);
    try {
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            console.log('+ Created:', dir);
        } else {
            console.log('= Exists:', dir);
        }
    } catch (e) {
        console.log('! Error:', dir, e.message);
    }
}

console.log('');
console.log('Done! All directories created.');
console.log('');
console.log('Next step: Run node master-setup.js OR create files manually');
