const express = require('express');
const {
  getAllCaseFields,
  getCaseFieldsByCategory,
  getCaseValues,
  updateCaseValues,
  deleteCaseValue,
  deleteCaseValues
} = require('../controllers/caseFieldController');
const { auth, requireRole } = require('../middleware/auth');
const { CaseField } = require('../models');

const router = express.Router();

// Apply JWT authentication to all routes
router.use(auth);

// Get all predefined case fields (any authenticated user)
router.get('/', getAllCaseFields);

// Get case fields by category (any authenticated user)
router.get('/category/:category', getCaseFieldsByCategory);

// Get all values for a specific case (any authenticated user)
router.get('/case/:caseId/values', getCaseValues);

// Add or update case values (any authenticated user)
router.put('/case/:caseId/values', updateCaseValues);

// Delete a spxecific case value (any authenticated user)
router.delete('/case/:caseId/values/:fieldKey', deleteCaseValue);

// Bulk delete case values (any authenticated user)
router.delete('/case/:caseId/values', deleteCaseValues);

// Temporary route to populate case fields (remove in production)
router.post('/populate', requireRole(['admin']), async (req, res) => {
  try {
    const caseFieldsData = [
      // Client Information (C1)
      { field_key: 'Name as per Aadhar C1', field_label: 'Name as per Aadhar C1', field_type: 'text', field_category: 'client_info', display_order: 1 },
      { field_key: 'Name as per PAN C1', field_label: 'Name as per PAN C1', field_type: 'text', field_category: 'client_info', display_order: 2 },
      { field_key: 'Name as per CML C1', field_label: 'Name as per CML C1', field_type: 'text', field_category: 'client_info', display_order: 3 },
      { field_key: 'Name as per Bank C1', field_label: 'Name as per Bank C1', field_type: 'text', field_category: 'client_info', display_order: 4 },
      { field_key: 'Name as per Passport C1', field_label: 'Name as per Passport C1', field_type: 'text', field_category: 'client_info', display_order: 5 },
      { field_key: 'Name as per Succession/WILL/LHA C1', field_label: 'Name as per Succession/WILL/LHA C1', field_type: 'text', field_category: 'client_info', display_order: 6 },
      { field_key: 'Name as per Cert C1', field_label: 'Name as per Cert C1', field_type: 'text', field_category: 'client_info', display_order: 7 },
      { field_key: 'PAN C1', field_label: 'PAN C1', field_type: 'text', field_category: 'client_info', display_order: 8 },
      { field_key: 'Mobile No C1', field_label: 'Mobile No C1', field_type: 'phone', field_category: 'client_info', display_order: 9 },
      { field_key: 'Email ID C1', field_label: 'Email ID C1', field_type: 'email', field_category: 'client_info', display_order: 10 },
      { field_key: 'DOB C1', field_label: 'DOB C1', field_type: 'date', field_category: 'client_info', display_order: 11 },
      { field_key: 'Father Name C1', field_label: 'Father Name C1', field_type: 'text', field_category: 'client_info', display_order: 12 },
      { field_key: 'Age C1', field_label: 'Age C1', field_type: 'number', field_category: 'client_info', display_order: 13 },
      { field_key: 'Deceased Relation C1', field_label: 'Deceased Relation C1', field_type: 'text', field_category: 'client_info', display_order: 14 },
      { field_key: 'Address C1', field_label: 'Address C1', field_type: 'text', field_category: 'client_info', display_order: 15 },
      { field_key: 'City', field_label: 'City', field_type: 'text', field_category: 'client_info', display_order: 16 },
      { field_key: 'State', field_label: 'State', field_type: 'text', field_category: 'client_info', display_order: 17 },
      { field_key: 'PIN C1', field_label: 'PIN C1', field_type: 'text', field_category: 'client_info', display_order: 18 },
      { field_key: 'Old Address C1', field_label: 'Old Address C1', field_type: 'text', field_category: 'client_info', display_order: 19 },
      
      // Banking Information
      { field_key: 'Bank AC Type C1', field_label: 'Bank AC Type C1', field_type: 'text', field_category: 'banking_info', display_order: 20 },
      { field_key: 'Bank Name C1', field_label: 'Bank Name C1', field_type: 'text', field_category: 'banking_info', display_order: 21 },
      { field_key: 'Bank AC C1', field_label: 'Bank AC C1', field_type: 'text', field_category: 'banking_info', display_order: 22 },
      { field_key: 'Bank Branch C1', field_label: 'Bank Branch C1', field_type: 'text', field_category: 'banking_info', display_order: 23 },
      { field_key: 'IFSC C1', field_label: 'IFSC C1', field_type: 'text', field_category: 'banking_info', display_order: 24 },
      { field_key: 'Bank Address C1', field_label: 'Bank Address C1', field_type: 'text', field_category: 'banking_info', display_order: 25 },
      { field_key: 'MICR C1', field_label: 'MICR C1', field_type: 'text', field_category: 'banking_info', display_order: 26 },
      { field_key: 'A/C Open Date C1', field_label: 'A/C Open Date C1', field_type: 'date', field_category: 'banking_info', display_order: 27 },
      { field_key: 'Bank City C1', field_label: 'Bank City C1', field_type: 'text', field_category: 'banking_info', display_order: 28 },
      { field_key: 'Bank PIN C1', field_label: 'Bank PIN C1', field_type: 'text', field_category: 'banking_info', display_order: 29 },
      
      // DEMAT Account
      { field_key: 'DEMAT AC C1', field_label: 'DEMAT AC C1', field_type: 'text', field_category: 'demat_info', display_order: 30 },
      
      // Deceased Information (H1-H4)
      { field_key: 'Name as per Certificate H1', field_label: 'Name as per Certificate H1', field_type: 'text', field_category: 'deceased_info', display_order: 31 },
      { field_key: 'Name as per DC H1', field_label: 'Name as per DC H1', field_type: 'text', field_category: 'deceased_info', display_order: 32 },
      { field_key: 'DOD H1', field_label: 'DOD H1', field_type: 'date', field_category: 'deceased_info', display_order: 33 },
      { field_key: 'Deceased Place H1', field_label: 'Deceased Place H1', field_type: 'text', field_category: 'deceased_info', display_order: 34 },
      { field_key: 'Claimant Relation H1', field_label: 'Claimant Relation H1', field_type: 'text', field_category: 'deceased_info', display_order: 35 },
      { field_key: 'Name as per Certificate H2', field_label: 'Name as per Certificate H2', field_type: 'text', field_category: 'deceased_info', display_order: 36 },
      { field_key: 'Name as per DC H2', field_label: 'Name as per DC H2', field_type: 'text', field_category: 'deceased_info', display_order: 37 },
      { field_key: 'DOD H2', field_label: 'DOD H2', field_type: 'date', field_category: 'deceased_info', display_order: 38 },
      { field_key: 'Deceased Place H2', field_label: 'Deceased Place H2', field_type: 'text', field_category: 'deceased_info', display_order: 39 },
      { field_key: 'Claimant Relation H2', field_label: 'Claimant Relation H2', field_type: 'text', field_category: 'deceased_info', display_order: 40 },
      { field_key: 'Name as per DC H3', field_label: 'Name as per DC H3', field_type: 'text', field_category: 'deceased_info', display_order: 41 },
      { field_key: 'DOD H3', field_label: 'DOD H3', field_type: 'date', field_category: 'deceased_info', display_order: 42 },
      { field_key: 'Deceased Place H3', field_label: 'Deceased Place H3', field_type: 'text', field_category: 'deceased_info', display_order: 43 },
      { field_key: 'Claimant Relation H3', field_label: 'Claimant Relation H3', field_type: 'text', field_category: 'deceased_info', display_order: 44 },
      { field_key: 'Name as per Certificate H4', field_label: 'Name as per Certificate H4', field_type: 'text', field_category: 'deceased_info', display_order: 45 },
      { field_key: 'Name as per DC H4', field_label: 'Name as per DC H4', field_type: 'text', field_category: 'deceased_info', display_order: 46 },
      { field_key: 'DOD H4', field_label: 'DOD H4', field_type: 'date', field_category: 'deceased_info', display_order: 47 },
      { field_key: 'Deceased Place H4', field_label: 'Deceased Place H4', field_type: 'text', field_category: 'deceased_info', display_order: 48 },
      { field_key: 'Claimant Relation H4', field_label: 'Claimant Relation H4', field_type: 'text', field_category: 'deceased_info', display_order: 49 },
      
      // Nominee Information
      { field_key: 'Nominee Name', field_label: 'Nominee Name', field_type: 'text', field_category: 'nominee_info', display_order: 50 },
      { field_key: 'Nominee Father/Spouse Name', field_label: 'Nominee Father/Spouse Name', field_type: 'text', field_category: 'nominee_info', display_order: 51 },
      { field_key: 'Nomnee Addres', field_label: 'Nominee Address', field_type: 'text', field_category: 'nominee_info', display_order: 52 },
      { field_key: 'Nominee DOB', field_label: 'Nominee DOB', field_type: 'date', field_category: 'nominee_info', display_order: 53 },
      { field_key: 'Nominee Mb No', field_label: 'Nominee Mobile Number', field_type: 'phone', field_category: 'nominee_info', display_order: 54 },
      { field_key: 'Nominee Email Id', field_label: 'Nominee Email Id', field_type: 'email', field_category: 'nominee_info', display_order: 55 },
      { field_key: 'Nominee Occupation', field_label: 'Nominee Occupation', field_type: 'text', field_category: 'nominee_info', display_order: 56 },
      { field_key: 'Nominee Relation', field_label: 'Nominee Relation', field_type: 'text', field_category: 'nominee_info', display_order: 57 },
      { field_key: 'Nominee Nationality', field_label: 'Nominee Nationality', field_type: 'text', field_category: 'nominee_info', display_order: 58 },
      
      // Company Information
      { field_key: 'Company Name', field_label: 'Company Name', field_type: 'text', field_category: 'company_info', display_order: 59 },
      { field_key: 'Folio No', field_label: 'Folio No', field_type: 'text', field_category: 'company_info', display_order: 60 },
      { field_key: 'Total Shares', field_label: 'Total Shares', field_type: 'number', field_category: 'company_info', display_order: 61 },
      { field_key: 'Face Value', field_label: 'Face Value', field_type: 'number', field_category: 'company_info', display_order: 62 },
      { field_key: 'RTA Name', field_label: 'RTA Name', field_type: 'text', field_category: 'company_info', display_order: 63 },
      { field_key: 'RTA Address', field_label: 'RTA Address', field_type: 'text', field_category: 'company_info', display_order: 64 },
      { field_key: 'Company Address', field_label: 'Company Address', field_type: 'text', field_category: 'company_info', display_order: 65 },
      
      // Share Certificate Information (SC1-SC10)
      // SC1 with Year of Purchase
      { field_key: 'SC1', field_label: 'SC1', field_type: 'text', field_category: 'shares_info', display_order: 66 },
      { field_key: 'DN1', field_label: 'DN1', field_type: 'text', field_category: 'shares_info', display_order: 67 },
      { field_key: 'NOS1', field_label: 'NOS1', field_type: 'text', field_category: 'shares_info', display_order: 68 },
      { field_key: 'SC Status1', field_label: 'SC Status1', field_type: 'text', field_category: 'shares_info', display_order: 69 },
      { field_key: 'Year of Purchase1', field_label: 'Year of Purchase1', field_type: 'number', field_category: 'shares_info', display_order: 70 },
      // SC2-SC10 without Year of Purchase
      { field_key: 'SC2', field_label: 'SC2', field_type: 'text', field_category: 'shares_info', display_order: 71 },
      { field_key: 'DN2', field_label: 'DN2', field_type: 'text', field_category: 'shares_info', display_order: 72 },
      { field_key: 'NOS2', field_label: 'NOS2', field_type: 'text', field_category: 'shares_info', display_order: 73 },
      { field_key: 'SC Status2', field_label: 'SC Status2', field_type: 'text', field_category: 'shares_info', display_order: 74 },
      { field_key: 'SC3', field_label: 'SC3', field_type: 'text', field_category: 'shares_info', display_order: 75 },
      { field_key: 'DN3', field_label: 'DN3', field_type: 'text', field_category: 'shares_info', display_order: 76 },
      { field_key: 'NOS3', field_label: 'NOS3', field_type: 'text', field_category: 'shares_info', display_order: 77 },
      { field_key: 'SC Status3', field_label: 'SC Status3', field_type: 'text', field_category: 'shares_info', display_order: 78 },
      { field_key: 'SC4', field_label: 'SC4', field_type: 'text', field_category: 'shares_info', display_order: 79 },
      { field_key: 'DN4', field_label: 'DN4', field_type: 'text', field_category: 'shares_info', display_order: 80 },
      { field_key: 'NOS4', field_label: 'NOS4', field_type: 'text', field_category: 'shares_info', display_order: 81 },
      { field_key: 'SC Status4', field_label: 'SC Status4', field_type: 'text', field_category: 'shares_info', display_order: 82 },
      { field_key: 'SC5', field_label: 'SC5', field_type: 'text', field_category: 'shares_info', display_order: 83 },
      { field_key: 'DN5', field_label: 'DN5', field_type: 'text', field_category: 'shares_info', display_order: 84 },
      { field_key: 'NOS5', field_label: 'NOS5', field_type: 'text', field_category: 'shares_info', display_order: 85 },
      { field_key: 'SC Status5', field_label: 'SC Status5', field_type: 'text', field_category: 'shares_info', display_order: 86 },
      { field_key: 'SC6', field_label: 'SC6', field_type: 'text', field_category: 'shares_info', display_order: 87 },
      { field_key: 'DN6', field_label: 'DN6', field_type: 'text', field_category: 'shares_info', display_order: 88 },
      { field_key: 'NOS6', field_label: 'NOS6', field_type: 'text', field_category: 'shares_info', display_order: 89 },
      { field_key: 'SC Status6', field_label: 'SC Status6', field_type: 'text', field_category: 'shares_info', display_order: 90 },
      { field_key: 'SC7', field_label: 'SC7', field_type: 'text', field_category: 'shares_info', display_order: 91 },
      { field_key: 'DN7', field_label: 'DN7', field_type: 'text', field_category: 'shares_info', display_order: 92 },
      { field_key: 'NOS7', field_label: 'NOS7', field_type: 'text', field_category: 'shares_info', display_order: 93 },
      { field_key: 'SC Status7', field_label: 'SC Status7', field_type: 'text', field_category: 'shares_info', display_order: 94 },
      { field_key: 'SC8', field_label: 'SC8', field_type: 'text', field_category: 'shares_info', display_order: 95 },
      { field_key: 'DN8', field_label: 'DN8', field_type: 'text', field_category: 'shares_info', display_order: 96 },
      { field_key: 'NOS8', field_label: 'NOS8', field_type: 'text', field_category: 'shares_info', display_order: 97 },
      { field_key: 'SC Status8', field_label: 'SC Status8', field_type: 'text', field_category: 'shares_info', display_order: 98 },
      { field_key: 'SC9', field_label: 'SC9', field_type: 'text', field_category: 'shares_info', display_order: 99 },
      { field_key: 'DN9', field_label: 'DN9', field_type: 'text', field_category: 'shares_info', display_order: 100 },
      { field_key: 'NOS9', field_label: 'NOS9', field_type: 'text', field_category: 'shares_info', display_order: 101 },
      { field_key: 'SC Status9', field_label: 'SC Status9', field_type: 'text', field_category: 'shares_info', display_order: 102 },
      { field_key: 'SC10', field_label: 'SC10', field_type: 'text', field_category: 'shares_info', display_order: 103 },
      { field_key: 'DN10', field_label: 'DN10', field_type: 'text', field_category: 'shares_info', display_order: 104 },
      { field_key: 'NOS10', field_label: 'NOS10', field_type: 'text', field_category: 'shares_info', display_order: 105 },
      { field_key: 'SC Status10', field_label: 'SC Status10', field_type: 'text', field_category: 'shares_info', display_order: 106 },
      
      // Legal Heir Information (LH1-LH5)
      { field_key: 'Name as per Aadhar LH1', field_label: 'Name as per Aadhar LH1', field_type: 'text', field_category: 'legal_heir_info', display_order: 107 },
      { field_key: 'Name as per PAN LH1', field_label: 'Name as per PAN LH1', field_type: 'text', field_category: 'legal_heir_info', display_order: 108 },
      { field_key: 'Name as per Succession/Will LH1', field_label: 'Name as per Succession/Will LH1', field_type: 'text', field_category: 'legal_heir_info', display_order: 109 },
      { field_key: 'Father Name LH1', field_label: 'Father Name LH1', field_type: 'text', field_category: 'legal_heir_info', display_order: 110 },
      { field_key: 'Address LH1', field_label: 'Address LH1', field_type: 'text', field_category: 'legal_heir_info', display_order: 111 },
      { field_key: 'Mobile No LH1', field_label: 'Mobile No LH1', field_type: 'phone', field_category: 'legal_heir_info', display_order: 112 },
      { field_key: 'Relation LH1', field_label: 'Relation LH1', field_type: 'text', field_category: 'legal_heir_info', display_order: 113 },
      { field_key: 'Age LH1', field_label: 'Age LH1', field_type: 'number', field_category: 'legal_heir_info', display_order: 114 },
      
      { field_key: 'Name as per Aadhar LH2', field_label: 'Name as per Aadhar LH2', field_type: 'text', field_category: 'legal_heir_info', display_order: 115 },
      { field_key: 'Name as per PAN LH2', field_label: 'Name as per PAN LH2', field_type: 'text', field_category: 'legal_heir_info', display_order: 116 },
      { field_key: 'Name as per Succession/Will LH2', field_label: 'Name as per Succession/Will LH2', field_type: 'text', field_category: 'legal_heir_info', display_order: 117 },
      { field_key: 'Father Name LH2', field_label: 'Father Name LH2', field_type: 'text', field_category: 'legal_heir_info', display_order: 118 },
      { field_key: 'Address LH2', field_label: 'Address LH2', field_type: 'text', field_category: 'legal_heir_info', display_order: 119 },
      { field_key: 'Mobile No LH2', field_label: 'Mobile No LH2', field_type: 'phone', field_category: 'legal_heir_info', display_order: 120 },
      { field_key: 'Relation LH2', field_label: 'Relation LH2', field_type: 'text', field_category: 'legal_heir_info', display_order: 121 },
      { field_key: 'Age LH2', field_label: 'Age LH2', field_type: 'number', field_category: 'legal_heir_info', display_order: 122 },
      
      { field_key: 'Name as per Aadhar LH3', field_label: 'Name as per Aadhar LH3', field_type: 'text', field_category: 'legal_heir_info', display_order: 123 },
      { field_key: 'Name as per PAN LH3', field_label: 'Name as per PAN LH3', field_type: 'text', field_category: 'legal_heir_info', display_order: 124 },
      { field_key: 'Name as per Succession/Will LH3', field_label: 'Name as per Succession/Will LH3', field_type: 'text', field_category: 'legal_heir_info', display_order: 125 },
      { field_key: 'Father Name LH3', field_label: 'Father Name LH3', field_type: 'text', field_category: 'legal_heir_info', display_order: 126 },
      { field_key: 'Address LH3', field_label: 'Address LH3', field_type: 'text', field_category: 'legal_heir_info', display_order: 127 },
      { field_key: 'Mobile No LH3', field_label: 'Mobile No LH3', field_type: 'phone', field_category: 'legal_heir_info', display_order: 128 },
      { field_key: 'Relation LH3', field_label: 'Relation LH3', field_type: 'text', field_category: 'legal_heir_info', display_order: 129 },
      { field_key: 'Age LH3', field_label: 'Age LH3', field_type: 'number', field_category: 'legal_heir_info', display_order: 130 },
      
      { field_key: 'Name as per Aadhar LH4', field_label: 'Name as per Aadhar LH4', field_type: 'text', field_category: 'legal_heir_info', display_order: 131 },
      { field_key: 'Name as per PAN LH4', field_label: 'Name as per PAN LH4', field_type: 'text', field_category: 'legal_heir_info', display_order: 132 },
      { field_key: 'Name as per Succession/Will LH4', field_label: 'Name as per Succession/Will LH4', field_type: 'text', field_category: 'legal_heir_info', display_order: 133 },
      { field_key: 'Father Name LH4', field_label: 'Father Name LH4', field_type: 'text', field_category: 'legal_heir_info', display_order: 134 },
      { field_key: 'Address LH4', field_label: 'Address LH4', field_type: 'text', field_category: 'legal_heir_info', display_order: 135 },
      { field_key: 'Mobile No LH4', field_label: 'Mobile No LH4', field_type: 'phone', field_category: 'legal_heir_info', display_order: 136 },
      { field_key: 'Relation LH4', field_label: 'Relation LH4', field_type: 'text', field_category: 'legal_heir_info', display_order: 137 },
      { field_key: 'Age LH4', field_label: 'Age LH4', field_type: 'number', field_category: 'legal_heir_info', display_order: 138 },
      
      { field_key: 'Name as per Aadhar LH5', field_label: 'Name as per Aadhar LH5', field_type: 'text', field_category: 'legal_heir_info', display_order: 139 },
      { field_key: 'Name as per PAN LH5', field_label: 'Name as per PAN LH5', field_type: 'text', field_category: 'legal_heir_info', display_order: 140 },
      { field_key: 'Name as per Succession/Will LH5', field_label: 'Name as per Succession/Will LH5', field_type: 'text', field_category: 'legal_heir_info', display_order: 141 },
      { field_key: 'Father Name LH5', field_label: 'Father Name LH5', field_type: 'text', field_category: 'legal_heir_info', display_order: 142 },
      { field_key: 'Address LH5', field_label: 'Address LH5', field_type: 'text', field_category: 'legal_heir_info', display_order: 143 },
      { field_key: 'Mobile No LH5', field_label: 'Mobile No LH5', field_type: 'phone', field_category: 'legal_heir_info', display_order: 144 },
      { field_key: 'Relation LH5', field_label: 'Relation LH5', field_type: 'text', field_category: 'legal_heir_info', display_order: 145 },
      { field_key: 'Age LH5', field_label: 'Age LH5', field_type: 'number', field_category: 'legal_heir_info', display_order: 146 },
      
      // Additional Information
      { field_key: 'Date of Issue', field_label: 'Date of Issue', field_type: 'date', field_category: 'additional_info', display_order: 147 }
    ];

    const results = [];
    const errors = [];

    for (const fieldData of caseFieldsData) {
      try {
        const [field, created] = await CaseField.findOrCreate({
          where: { field_key: fieldData.field_key },
          defaults: fieldData
        });
        
        results.push({
          field_key: fieldData.field_key,
          status: created ? 'created' : 'already_exists',
          id: field.id
        });
      } catch (error) {
        errors.push({ 
          field_key: fieldData.field_key, 
          error: error.message 
        });
      }
    }

    res.json({
      message: 'Case fields populated successfully',
      results,
      errors,
      total_processed: caseFieldsData.length,
      successful: results.length,
      failed: errors.length
    });

  } catch (error) {
    console.error('Populate case fields error:', error);
    res.status(500).json({ error: 'Failed to populate case fields.' });
  }
});

module.exports = router;
