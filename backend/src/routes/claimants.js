const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getClaimantsByCompany,
  createClaimant,
  getClaimantDetails,
  updateClaimant,
  deleteClaimant,
  reorderClaimants
} = require('../controllers/claimantController');

// Apply authentication middleware to all routes
router.use(auth);

// Get all claimants for a specific company
router.get('/company/:companyId', getClaimantsByCompany);

// Create a new claimant for a company
router.post('/company/:companyId', createClaimant);

// Get claimant details
router.get('/:claimantId', getClaimantDetails);

// Update claimant details
router.put('/:claimantId', updateClaimant);

// Delete claimant
router.delete('/:claimantId', deleteClaimant);

// Reorder claimants
router.patch('/company/:companyId/reorder', reorderClaimants);

module.exports = router;
