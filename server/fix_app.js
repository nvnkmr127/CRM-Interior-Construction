const fs = require('fs');
let code = fs.readFileSync('src/app.js', 'utf8');

const target = `app.use(cookieParser());`;
const replace = `app.use(cookieParser());\n\nconst asyncLocalStorage = require('./utils/requestContext');\napp.use((req, res, next) => {\n  asyncLocalStorage.run({ req }, () => {\n    next();\n  });\n});`;

code = code.replace(target, replace);
fs.writeFileSync('src/app.js', code);
console.log('updated app.js');
