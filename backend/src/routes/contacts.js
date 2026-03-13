const express = require('express');
const contactController = require('../controllers/contactController');

const router = express.Router();

// GET all contacts
router.get('/', contactController.list);

// GET single contact by id
router.get('/:id', contactController.getById);

// POST new contact (JSON body: firstName, lastName, phoneNumber, city)
router.post('/', contactController.create);

module.exports = router;
