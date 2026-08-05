const fs = require('fs');
const path = require('path');

const projectsPath = path.join(__dirname, 'server', 'src', 'routes', 'projects.js');
let content = fs.readFileSync(projectsPath, 'utf8');

const schemaRegex = /const (\w+Schema) = z\.object\(\{([\s\S]*?)\}\);/g;

let match;
const schemas = [];
let extractedCode = `const { z } = require('zod');\n\n`;

// Since there could be nested objects (like `z.array(z.object({}))`), a simple regex might match the wrong closing `});`.
// Actually, look at the code: many have `contacts: z.array(z.object({ ... }))` which would break `([\s\S]*?)\}\);`!
// A better way is to do AST parsing, but we don't have acorn or babel installed globally maybe?
// Let's use a simpler approach: extract everything manually or write a balanced brace parser.
