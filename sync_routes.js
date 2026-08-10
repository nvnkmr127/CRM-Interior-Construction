const fs = require('fs');
const path = require('path');

const serverRoutesDir = path.join(__dirname, 'server', 'src', 'routes');
const clientApiDir = path.join(__dirname, 'client', 'src', 'api');

// Boilerplate for client API
const apiBoilerplate = (name) => `import api from './axios';

export const getAll = async (params) => {
  return await api.get('/${name}', { params });
};

export const getById = async (id) => {
  return await api.get(\`/${name}/\${id}\`);
};

export const create = async (data) => {
  return await api.post('/${name}', data);
};

export const update = async (id, data) => {
  return await api.put(\`/${name}/\${id}\`, data);
};

export const remove = async (id) => {
  return await api.delete(\`/${name}/\${id}\`);
};
`;

// Boilerplate for server route
const routeBoilerplate = (name) => `const express = require('express');
const router = express.Router();
// const auth = require('../middleware/auth'); // Uncomment if authentication is required

router.get('/', (req, res) => {
    res.json({ message: 'Get all ${name}' });
});

router.get('/:id', (req, res) => {
    res.json({ message: 'Get ${name} by id' });
});

router.post('/', (req, res) => {
    res.json({ message: 'Create ${name}' });
});

router.put('/:id', (req, res) => {
    res.json({ message: 'Update ${name}' });
});

router.delete('/:id', (req, res) => {
    res.json({ message: 'Delete ${name}' });
});

module.exports = router;
`;

const serverRoutes = fs.readdirSync(serverRoutesDir).filter(f => f.endsWith('.js') && fs.statSync(path.join(serverRoutesDir, f)).isFile()).map(f => f.replace('.js', ''));
const clientApis = fs.readdirSync(clientApiDir).filter(f => f.endsWith('.js') && fs.statSync(path.join(clientApiDir, f)).isFile()).map(f => f.replace('.js', ''));

const missingInClient = serverRoutes.filter(r => !clientApis.includes(r));
const missingInServer = clientApis.filter(a => !serverRoutes.includes(a) && a !== 'index' && a !== 'axios' && a !== 'config' && a !== 'mockData' && a !== 'mockInterceptor');

console.log('Missing in Client (Creating API files):', missingInClient.length);
missingInClient.forEach(file => {
    const filePath = path.join(clientApiDir, `${file}.js`);
    fs.writeFileSync(filePath, apiBoilerplate(file));
    console.log(`Created client/src/api/${file}.js`);
});

console.log('Missing in Server (Creating Route files):', missingInServer.length);
missingInServer.forEach(file => {
    const filePath = path.join(serverRoutesDir, `${file}.js`);
    fs.writeFileSync(filePath, routeBoilerplate(file));
    console.log(`Created server/src/routes/${file}.js`);
});

console.log('Sync complete!');
