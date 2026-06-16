const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    for (const [search, replace] of replacements) {
        content = content.replace(search, replace);
    }
    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log('Updated:', filePath);
    }
}

const clientSrc = path.join(__dirname, 'client', 'src');

const hookReplacements = [
    [/import usePageTitle from ['"].*?usePageTitle['"];?/g, "import { usePageTitle } from '../../hooks/usePageTitle';"],
    [/import useBreadcrumbs from ['"].*?useBreadcrumbs['"];?/g, "import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';"]
];

replaceInFile(path.join(clientSrc, 'pages', 'tasks', 'MyTasksPage.jsx'), hookReplacements);
replaceInFile(path.join(clientSrc, 'pages', 'settings', 'ProfilePage.jsx'), hookReplacements);
replaceInFile(path.join(clientSrc, 'pages', 'analytics', 'LeadAnalyticsPage.jsx'), hookReplacements);
replaceInFile(path.join(clientSrc, 'pages', 'analytics', 'ProjectAnalyticsPage.jsx'), hookReplacements);

