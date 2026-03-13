const express = require('express');
const iepfController = require('../controllers/iepfController');

const router = express.Router();

// GET all IEPF form submissions (e.g. for admin)
router.get('/', iepfController.list);

// POST new IEPF form (saves to DB and sends email)
router.post('/', iepfController.create);

module.exports = router;
