const express = require('express');
const { auth } = require('../middleware/auth');
const {
  getDashboardDetails,
  getDashboardFilterList
} = require('../controllers/dashboardController');

const router = express.Router();

router.use(auth);

router.get('/filters', getDashboardFilterList);
router.get('/details/:filter', getDashboardDetails);

module.exports = router;
