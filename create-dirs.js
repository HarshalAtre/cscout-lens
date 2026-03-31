const fs = require('fs');
const dirs = ['sample/calc', 'src/db', 'src/scripts', 'src/services', 'src/webview', 'src/test', 'resources'];
dirs.forEach(d => { fs.mkdirSync(d, { recursive: true }); console.log('Created: ' + d); });
console.log('All directories created!');
