const express = require('express');
const workActivityRepository = require('../../repositories/workActivityRepository');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const templates = await workActivityRepository.findTradeDependencyTemplates(req.tenantId);
    res.json({ data: templates });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { trade, depends_on_trade } = req.body;
    if (!trade || !depends_on_trade) {
      return res.status(400).json({ error: { message: 'Trade and dependent trade are required' } });
    }
    const template = await workActivityRepository.createTradeDependencyTemplate(req.tenantId, req.body);
    res.status(201).json({ data: template });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await workActivityRepository.deleteTradeDependencyTemplate(req.params.id, req.tenantId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
