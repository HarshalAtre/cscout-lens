const fs = require('fs');
const path = require('path');

const dirs = [
    "D:/Gsoc/C-scout/cscout/cscout-lens/sample/calc",
    "D:/Gsoc/C-scout/cscout/cscout-lens/src/db",
    "D:/Gsoc/C-scout/cscout/cscout-lens/src/scripts",
    "D:/Gsoc/C-scout/cscout/cscout-lens/src/services",
    "D:/Gsoc/C-scout/cscout/cscout-lens/src/webview",
    "D:/Gsoc/C-scout/cscout/cscout-lens/src/test",
    "D:/Gsoc/C-scout/cscout/cscout-lens/resources"
];

dirs.forEach(dir => {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created: ${dir}`);
});

console.log("\nAll directories created successfully");
console.log("\nNow running master-setup.js...\n");

// Run the master-setup.js
require('./master-setup.js');
