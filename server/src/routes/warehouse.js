const express = require('express');
const router = express.Router();
// const auth = require('../middleware/auth'); // Uncomment if authentication is required

router.get('/', (req, res) => {
    res.json({ message: 'Get all warehouse' });
});

router.get('/:id', (req, res) => {
    res.json({ message: 'Get warehouse by id' });
});

router.post('/', (req, res) => {
    res.json({ message: 'Create warehouse' });
});

router.put('/:id', (req, res) => {
    res.json({ message: 'Update warehouse' });
});

router.delete('/:id', (req, res) => {
    res.json({ message: 'Delete warehouse' });
});

module.exports = router;
