const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getAllCompanies,
  getCompaniesByCase,
  createCompany,
  getCompanyDetails,
  getCompanyValues,
  updateCompanyValues,
  updateCompanyStatus,
  deleteCompany,
  addJointHolder,
  removeJointHolder,
  updateReviewerComment,
  approveCompanyReview,
  rejectCompanyReview,
  duplicateCompany,
  getReviewerStats
} = require('../controllers/companyController');

const { deleteCase } = require('../controllers/caseController');

// Apply authentication middleware to all routes
router.use(auth);

// Get all companies (with optional query filters: assigned_to, status, case_id)
router.get('/', getAllCompanies);

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

// Delete case (from companies context)
router.delete('/case/:caseId', deleteCase);

// Joint Holder Management
// Add new joint holder fields
router.post('/:companyId/joint-holders', addJointHolder);

// Remove joint holder fields
router.delete('/:companyId/joint-holders', removeJointHolder);

// Data Reviewer endpoints
// Get reviewer tracking statistics
router.get('/reviewer/stats', getReviewerStats);

// Update reviewer comment for a field
router.patch('/:companyId/reviewer-comment', updateReviewerComment);

// Approve company after review
router.post('/:companyId/approve-review', approveCompanyReview);

// Reject company and send back to employee
router.post('/:companyId/reject-review', rejectCompanyReview);

// Duplicate company with all its values
router.post('/:companyId/duplicate', duplicateCompany);

module.exports = router;
