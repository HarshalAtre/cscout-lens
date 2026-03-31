const fs = require('fs');
const path = require('path');

const baseDir = 'D:\\Gsoc\\C-scout\\cscout\\cscout-lens';
const dirs = ['sample/calc', 'src/db', 'src/scripts', 'src/services', 'src/webview', 'src/test', 'resources'];

console.log('Creating directories in: ' + baseDir);
console.log('');

let created = 0;
for (const d of dirs) {
    const fullPath = path.join(baseDir, d);
    try {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log('✓ Created:', fullPath);
        created++;
    } catch (err) {
        console.log('✗ Failed to create ' + fullPath + ': ' + err.message);
    }
}

console.log('');
console.log('Summary: ' + created + ' out of ' + dirs.length + ' directories created/verified');
