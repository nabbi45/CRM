const fs = require('fs');
const path = require('path');

const srcDir = path.join('c:', 'Users', '91972', 'Documents', 'CRM UPDATED G', 'CRM UPDATED G', 'CRM_FRONTEND', 'src');

const replacements = [
    { regex: /#e87c2a/gi, replacement: '#111827' },
    { regex: /#f59e4b/gi, replacement: '#334155' },
    { regex: /#c2641c/gi, replacement: '#000000' }
];

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.css') || fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            
            for (const r of replacements) {
                if (r.regex.test(content)) {
                    content = content.replace(r.regex, r.replacement);
                    modified = true;
                }
            }
            
            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated: ${fullPath}`);
            }
        }
    }
}

processDirectory(srcDir);
console.log('Color replacement complete.');
