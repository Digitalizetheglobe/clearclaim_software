const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getCompaniesByCase,
  createCompany,
  getCompanyDetails,
  getCompanyValues,
  updateCompanyValues,
  updateCompanyStatus,
  deleteCompany
} = require('../controllers/companyController');

// Apply authentication middleware to all routes
router.use(auth);

// Get all companies for a specific case
router.get('/case/:caseId', getCompaniesByCase);

// Create a new company for a case
router.post('/', createCompany);

// Get company details
router.get('/:companyId', getCompanyDetails);

// Get company values (case fields for this company)
router.get('/:companyId/values', getCompanyValues);

// Update company values
router.put('/:companyId/values', updateCompanyValues);

// Update company status
router.patch('/:companyId/status', updateCompanyStatus);

// Delete company
router.delete('/:companyId', deleteCompany);

module.exports = router;
