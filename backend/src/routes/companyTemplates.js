const express = require('express');
const router = express.Router();
const companyTemplateController = require('../controllers/companyTemplateController');
const { authenticateToken } = require('../middleware/auth');
const devAuth = require('../middleware/devAuth');

// Get all available templates for a company
router.get('/:companyId', devAuth, companyTemplateController.getCompanyTemplates);

// Update template selections for a company
router.put('/:companyId', devAuth, companyTemplateController.updateCompanyTemplates);

// Get mapping preview for a template
router.get('/:companyId/preview/:templateId', devAuth, companyTemplateController.getTemplateMappingPreview);

// Download a specific template (with mapping info)
router.get('/:companyId/download/:templateId', devAuth, companyTemplateController.downloadTemplate);

// Download populated template (actual file with mapped values)
router.get('/:companyId/download/:templateId/populated', devAuth, companyTemplateController.downloadPopulatedTemplate);

// Get template statistics for a company
router.get('/:companyId/stats', devAuth, companyTemplateController.getTemplateStats);

// Get selected templates for a company (admin review)
router.get('/:companyId/selected', devAuth, companyTemplateController.getSelectedTemplates);

// Update admin comment for a template
router.patch('/:templateId/comment', devAuth, companyTemplateController.updateTemplateComment);

// Update employee response for a template
router.patch('/:templateId/employee-response', devAuth, companyTemplateController.updateEmployeeResponse);

// Get template preview for admin review
router.get('/:companyId/template-preview/:templateId', devAuth, companyTemplateController.getTemplatePreview);

// Get employee performance metrics (admin only)
router.get('/performance/employees', devAuth, companyTemplateController.getEmployeePerformance);

// Get detailed templates for a specific employee performance metric (admin only)
router.get('/performance/employee/:employeeId/details', devAuth, companyTemplateController.getEmployeePerformanceDetails);

module.exports = router;
