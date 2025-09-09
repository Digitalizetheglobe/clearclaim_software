const express = require('express');
const {
  getAllTemplates,
  getTemplatePreview,
  downloadPopulatedTemplate,
  getTemplateStats
} = require('../controllers/caseTemplateController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Apply JWT authentication to all template routes
router.use(auth);

// Get all available templates
router.get('/', getAllTemplates);

// Get template statistics
router.get('/stats', getTemplateStats);

// Get template preview with case data
router.get('/case/:caseId/template/:templateName/preview', getTemplatePreview);

// Download populated template
router.get('/case/:caseId/template/:templateName/download', downloadPopulatedTemplate);

module.exports = router;
