const express = require('express');
const inquiryController = require('../controllers/inquiryController');

const router = express.Router();

// GET options for form dropdowns (investment types & time slots)
router.get('/options', inquiryController.getOptions);

// GET all inquiries (e.g. for admin listing)
router.get('/', inquiryController.list);

// POST new inquiry (form submit) - saves to DB and sends email
router.post('/', inquiryController.create);

module.exports = router;
