const express = require('express');
const shareRecoveryController = require('../controllers/shareRecoveryController');

const router = express.Router();

// GET all recovery-of-share submissions (e.g. for admin)
router.get('/', shareRecoveryController.list);

// POST new recovery-of-share form (saves to DB and sends email)
router.post('/', shareRecoveryController.create);

module.exports = router;
