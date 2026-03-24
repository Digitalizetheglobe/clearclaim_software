const express = require('express');
const { auth, requireRole } = require('../middleware/auth');
const {
  getCompanyStatuses,
  createCompanyStatus,
  updateCompanyStatusMaster,
  getCompanyStatusUsage,
  reassignCompanyStatusUsage,
  deleteCompanyStatus
} = require('../controllers/companyStatusController');

const router = express.Router();

router.use(auth);

router.get('/', getCompanyStatuses);
router.post('/', requireRole(['admin']), createCompanyStatus);
router.put('/:id', requireRole(['admin']), updateCompanyStatusMaster);
router.get('/:id/usage', requireRole(['admin']), getCompanyStatusUsage);
router.put('/:id/reassign', requireRole(['admin']), reassignCompanyStatusUsage);
router.delete('/:id', requireRole(['admin']), deleteCompanyStatus);

module.exports = router;
