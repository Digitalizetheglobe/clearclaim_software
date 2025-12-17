const express = require('express');
const {
  getAllCases,
  getCaseById,
  createCase,
  updateCase,
  deleteCase,
  getCaseStats,
  getMyAssignedCases,
  getPrintReadyCases
} = require('../controllers/caseController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Apply JWT authentication to all case routes
router.use(auth);

// Get all cases with filters and pagination (admin only)
router.get('/', requireRole(['admin']), getAllCases);

// Get case statistics (admin only)
router.get('/stats', requireRole(['admin']), getCaseStats);

// Get cases assigned to the current logged-in user (any authenticated user)
router.get('/my-assigned', getMyAssignedCases);

// Get print-ready cases (admin only)
router.get('/print-ready', requireRole(['admin']), getPrintReadyCases);

// Get single case by ID (user can only see their assigned cases or admin can see all)
router.get('/:id', getCaseById);

// Create new case (admin and sales only)
router.post('/', requireRole(['admin', 'sales', 'employee']), createCase);

// Update case (admin and assigned user can update)
router.put('/:id', updateCase);

// Delete case (admin only)
router.delete('/:id', requireRole(['admin']), deleteCase);

module.exports = router;
