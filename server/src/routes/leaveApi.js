const express = require('express');
const router = express.Router();
// const auth = require('../middleware/auth'); // Uncomment if authentication is required

router.get('/', (req, res) => {
    res.json({ message: 'Get all leaveApi' });
});

router.get('/:id', (req, res) => {
    res.json({ message: 'Get leaveApi by id' });
});

router.post('/', (req, res) => {
    res.json({ message: 'Create leaveApi' });
});

router.put('/:id', (req, res) => {
    res.json({ message: 'Update leaveApi' });
});

router.delete('/:id', (req, res) => {
    res.json({ message: 'Delete leaveApi' });
});

module.exports = router;
