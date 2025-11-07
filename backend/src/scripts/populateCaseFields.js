const { CaseField } = require('../models');

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

  // Joint Holder 1 Information (C2)
  { field_key: 'Name as per Aadhar C2', field_label: 'Name as per Aadhar C2', field_type: 'text', field_category: 'joint_holder_1', display_order: 31 },
  { field_key: 'Name as per PAN C2', field_label: 'Name as per PAN C2', field_type: 'text', field_category: 'joint_holder_1', display_order: 32 },
  { field_key: 'Name as per CML C2', field_label: 'Name as per CML C2', field_type: 'text', field_category: 'joint_holder_1', display_order: 33 },
  { field_key: 'Name as per Bank C2', field_label: 'Name as per Bank C2', field_type: 'text', field_category: 'joint_holder_1', display_order: 34 },
  { field_key: 'Name as per Passport C2', field_label: 'Name as per Passport C2', field_type: 'text', field_category: 'joint_holder_1', display_order: 35 },
  { field_key: 'Name as per Succession/WILL/LHA C2', field_label: 'Name as per Succession/WILL/LHA C2', field_type: 'text', field_category: 'joint_holder_1', display_order: 36 },
  { field_key: 'Name as per Cert C2', field_label: 'Name as per Cert C2', field_type: 'text', field_category: 'joint_holder_1', display_order: 37 },
  { field_key: 'PAN C2', field_label: 'PAN C2', field_type: 'text', field_category: 'joint_holder_1', display_order: 38 },
  { field_key: 'Mobile No C2', field_label: 'Mobile No C2', field_type: 'phone', field_category: 'joint_holder_1', display_order: 39 },
  { field_key: 'Email ID C2', field_label: 'Email ID C2', field_type: 'email', field_category: 'joint_holder_1', display_order: 40 },
  { field_key: 'DOB C2', field_label: 'DOB C2', field_type: 'date', field_category: 'joint_holder_1', display_order: 41 },
  { field_key: 'Father Name C2', field_label: 'Father Name C2', field_type: 'text', field_category: 'joint_holder_1', display_order: 42 },
  { field_key: 'Age C2', field_label: 'Age C2', field_type: 'number', field_category: 'joint_holder_1', display_order: 43 },
  { field_key: 'Deceased Relation C2', field_label: 'Deceased Relation C2', field_type: 'text', field_category: 'joint_holder_1', display_order: 44 },
  { field_key: 'Address C2', field_label: 'Address C2', field_type: 'text', field_category: 'joint_holder_1', display_order: 45 },
  { field_key: 'PIN C2', field_label: 'PIN C2', field_type: 'text', field_category: 'joint_holder_1', display_order: 46 },
  { field_key: 'Old Address C2', field_label: 'Old Address C2', field_type: 'text', field_category: 'joint_holder_1', display_order: 47 },

  // Joint Holder 1 Banking Information
  { field_key: 'Bank AC Type C2', field_label: 'Bank AC Type C2', field_type: 'text', field_category: 'joint_holder_1_banking', display_order: 48 },
  { field_key: 'Bank Name C2', field_label: 'Bank Name C2', field_type: 'text', field_category: 'joint_holder_1_banking', display_order: 49 },
  { field_key: 'Bank AC C2', field_label: 'Bank AC C2', field_type: 'text', field_category: 'joint_holder_1_banking', display_order: 50 },
  { field_key: 'Bank Branch C2', field_label: 'Bank Branch C2', field_type: 'text', field_category: 'joint_holder_1_banking', display_order: 51 },
  { field_key: 'IFSC C2', field_label: 'IFSC C2', field_type: 'text', field_category: 'joint_holder_1_banking', display_order: 52 },
  { field_key: 'Bank Address C2', field_label: 'Bank Address C2', field_type: 'text', field_category: 'joint_holder_1_banking', display_order: 53 },
  { field_key: 'MICR C2', field_label: 'MICR C2', field_type: 'text', field_category: 'joint_holder_1_banking', display_order: 54 },
  { field_key: 'A/C Open Date C2', field_label: 'A/C Open Date C2', field_type: 'date', field_category: 'joint_holder_1_banking', display_order: 55 },
  { field_key: 'Bank City C2', field_label: 'Bank City C2', field_type: 'text', field_category: 'joint_holder_1_banking', display_order: 56 },
  { field_key: 'Bank PIN C2', field_label: 'Bank PIN C2', field_type: 'text', field_category: 'joint_holder_1_banking', display_order: 57 },

  // Joint Holder 1 DEMAT Account
  { field_key: 'DEMAT AC C2', field_label: 'DEMAT AC C2', field_type: 'text', field_category: 'joint_holder_1_demat', display_order: 58 },

  // Joint Holder 2 Information (C3)
  { field_key: 'Name as per Aadhar C3', field_label: 'Name as per Aadhar C3', field_type: 'text', field_category: 'joint_holder_2', display_order: 59 },
  { field_key: 'Name as per PAN C3', field_label: 'Name as per PAN C3', field_type: 'text', field_category: 'joint_holder_2', display_order: 60 },
  { field_key: 'Name as per CML C3', field_label: 'Name as per CML C3', field_type: 'text', field_category: 'joint_holder_2', display_order: 61 },
  { field_key: 'Name as per Bank C3', field_label: 'Name as per Bank C3', field_type: 'text', field_category: 'joint_holder_2', display_order: 62 },
  { field_key: 'Name as per Passport C3', field_label: 'Name as per Passport C3', field_type: 'text', field_category: 'joint_holder_2', display_order: 63 },
  { field_key: 'Name as per Succession/WILL/LHA C3', field_label: 'Name as per Succession/WILL/LHA C3', field_type: 'text', field_category: 'joint_holder_2', display_order: 64 },
  { field_key: 'Name as per Cert C3', field_label: 'Name as per Cert C3', field_type: 'text', field_category: 'joint_holder_2', display_order: 65 },
  { field_key: 'PAN C3', field_label: 'PAN C3', field_type: 'text', field_category: 'joint_holder_2', display_order: 66 },
  { field_key: 'Mobile No C3', field_label: 'Mobile No C3', field_type: 'phone', field_category: 'joint_holder_2', display_order: 67 },
  { field_key: 'Email ID C3', field_label: 'Email ID C3', field_type: 'email', field_category: 'joint_holder_2', display_order: 68 },
  { field_key: 'DOB C3', field_label: 'DOB C3', field_type: 'date', field_category: 'joint_holder_2', display_order: 69 },
  { field_key: 'Father Name C3', field_label: 'Father Name C3', field_type: 'text', field_category: 'joint_holder_2', display_order: 70 },
  { field_key: 'Age C3', field_label: 'Age C3', field_type: 'number', field_category: 'joint_holder_2', display_order: 71 },
  { field_key: 'Deceased Relation C3', field_label: 'Deceased Relation C3', field_type: 'text', field_category: 'joint_holder_2', display_order: 72 },
  { field_key: 'Address C3', field_label: 'Address C3', field_type: 'text', field_category: 'joint_holder_2', display_order: 73 },
  { field_key: 'PIN C3', field_label: 'PIN C3', field_type: 'text', field_category: 'joint_holder_2', display_order: 74 },
  { field_key: 'Old Address C3', field_label: 'Old Address C3', field_type: 'text', field_category: 'joint_holder_2', display_order: 75 },

  // Joint Holder 2 Banking Information
  { field_key: 'Bank AC Type C3', field_label: 'Bank AC Type C3', field_type: 'text', field_category: 'joint_holder_2_banking', display_order: 76 },
  { field_key: 'Bank Name C3', field_label: 'Bank Name C3', field_type: 'text', field_category: 'joint_holder_2_banking', display_order: 77 },
  { field_key: 'Bank AC C3', field_label: 'Bank AC C3', field_type: 'text', field_category: 'joint_holder_2_banking', display_order: 78 },
  { field_key: 'Bank Branch C3', field_label: 'Bank Branch C3', field_type: 'text', field_category: 'joint_holder_2_banking', display_order: 79 },
  { field_key: 'IFSC C3', field_label: 'IFSC C3', field_type: 'text', field_category: 'joint_holder_2_banking', display_order: 80 },
  { field_key: 'Bank Address C3', field_label: 'Bank Address C3', field_type: 'text', field_category: 'joint_holder_2_banking', display_order: 81 },
  { field_key: 'MICR C3', field_label: 'MICR C3', field_type: 'text', field_category: 'joint_holder_2_banking', display_order: 82 },
  { field_key: 'A/C Open Date C3', field_label: 'A/C Open Date C3', field_type: 'date', field_category: 'joint_holder_2_banking', display_order: 83 },
  { field_key: 'Bank City C3', field_label: 'Bank City C3', field_type: 'text', field_category: 'joint_holder_2_banking', display_order: 84 },
  { field_key: 'Bank PIN C3', field_label: 'Bank PIN C3', field_type: 'text', field_category: 'joint_holder_2_banking', display_order: 85 },

  // Joint Holder 2 DEMAT Account
  { field_key: 'DEMAT AC C3', field_label: 'DEMAT AC C3', field_type: 'text', field_category: 'joint_holder_2_demat', display_order: 86 },

  // Deceased Information (H1-H4)
  { field_key: 'Name as per Certificate H1', field_label: 'Name as per Certificate H1', field_type: 'text', field_category: 'deceased_info', display_order: 87 },
  { field_key: 'Name as per DC H1', field_label: 'Name as per DC H1', field_type: 'text', field_category: 'deceased_info', display_order: 88 },
  { field_key: 'DOD H1', field_label: 'DOD H1', field_type: 'date', field_category: 'deceased_info', display_order: 89 },
  { field_key: 'Deceased Place H1', field_label: 'Deceased Place H1', field_type: 'text', field_category: 'deceased_info', display_order: 90 },
  { field_key: 'Claimant Relation H1', field_label: 'Claimant Relation H1', field_type: 'text', field_category: 'deceased_info', display_order: 91 },
  { field_key: 'Name as per Certificate H2', field_label: 'Name as per Certificate H2', field_type: 'text', field_category: 'deceased_info', display_order: 92 },
  { field_key: 'Name as per DC H2', field_label: 'Name as per DC H2', field_type: 'text', field_category: 'deceased_info', display_order: 93 },
  { field_key: 'DOD H2', field_label: 'DOD H2', field_type: 'date', field_category: 'deceased_info', display_order: 94 },
  { field_key: 'Deceased Place H2', field_label: 'Deceased Place H2', field_type: 'text', field_category: 'deceased_info', display_order: 95 },
  { field_key: 'Claimant Relation H2', field_label: 'Claimant Relation H2', field_type: 'text', field_category: 'deceased_info', display_order: 96 },
  { field_key: 'Name as per DC H3', field_label: 'Name as per DC H3', field_type: 'text', field_category: 'deceased_info', display_order: 97 },
  { field_key: 'DOD H3', field_label: 'DOD H3', field_type: 'date', field_category: 'deceased_info', display_order: 98 },
  { field_key: 'Deceased Place H3', field_label: 'Deceased Place H3', field_type: 'text', field_category: 'deceased_info', display_order: 99 },
  { field_key: 'Claimant Relation H3', field_label: 'Claimant Relation H3', field_type: 'text', field_category: 'deceased_info', display_order: 100 },
  { field_key: 'Name as per Certificate H4', field_label: 'Name as per Certificate H4', field_type: 'text', field_category: 'deceased_info', display_order: 101 },
  { field_key: 'Name as per DC H4', field_label: 'Name as per DC H4', field_type: 'text', field_category: 'deceased_info', display_order: 102 },
  { field_key: 'DOD H4', field_label: 'DOD H4', field_type: 'date', field_category: 'deceased_info', display_order: 103 },
  { field_key: 'Deceased Place H4', field_label: 'Deceased Place H4', field_type: 'text', field_category: 'deceased_info', display_order: 104 },
  { field_key: 'Claimant Relation H4', field_label: 'Claimant Relation H4', field_type: 'text', field_category: 'deceased_info', display_order: 105 },

  // Nominee Information
  { field_key: 'Nominee Name', field_label: 'Nominee Name', field_type: 'text', field_category: 'nominee_info', display_order: 106 },
  { field_key: 'Nominee Father/Spouse Name', field_label: 'Nominee Father/Spouse Name', field_type: 'text', field_category: 'nominee_info', display_order: 107 },
  { field_key: 'Nomnee Addres', field_label: 'Nominee Address', field_type: 'text', field_category: 'nominee_info', display_order: 108 },
  { field_key: 'Nominee DOB', field_label: 'Nominee DOB', field_type: 'date', field_category: 'nominee_info', display_order: 109 },
  { field_key: 'Nominee Mb No', field_label: 'Nominee Mobile Number', field_type: 'phone', field_category: 'nominee_info', display_order: 110 },
  { field_key: 'Nominee Email Id', field_label: 'Nominee Email Id', field_type: 'email', field_category: 'nominee_info', display_order: 111 },
  { field_key: 'Nominee Occupation', field_label: 'Nominee Occupation', field_type: 'text', field_category: 'nominee_info', display_order: 112 },
  { field_key: 'Nominee Relation', field_label: 'Nominee Relation', field_type: 'text', field_category: 'nominee_info', display_order: 113 },
  { field_key: 'Nominee Nationality', field_label: 'Nominee Nationality', field_type: 'text', field_category: 'nominee_info', display_order: 114 },

  // Company Information
  { field_key: 'Company Name', field_label: 'Company Name', field_type: 'text', field_category: 'company_info', display_order: 115 },
  { field_key: 'Folio No', field_label: 'Folio No', field_type: 'text', field_category: 'company_info', display_order: 116 },
  { field_key: 'Total Shares', field_label: 'Total Shares', field_type: 'number', field_category: 'company_info', display_order: 117 },
  { field_key: 'Face Value', field_label: 'Face Value', field_type: 'number', field_category: 'company_info', display_order: 118 },
  { field_key: 'RTA Name', field_label: 'RTA Name', field_type: 'text', field_category: 'company_info', display_order: 119 },
  { field_key: 'RTA Address', field_label: 'RTA Address', field_type: 'text', field_category: 'company_info', display_order: 120 },
  { field_key: 'Company Address', field_label: 'Company Address', field_type: 'text', field_category: 'company_info', display_order: 121 },

  // Share Certificate Information (SC1-SC10)
  // SC1 with Year of Purchase
  { field_key: 'SC1', field_label: 'SC1', field_type: 'text', field_category: 'shares_info', display_order: 122 },
  { field_key: 'DN1', field_label: 'DN1', field_type: 'text', field_category: 'shares_info', display_order: 123 },
  { field_key: 'NOS1', field_label: 'NOS1', field_type: 'text', field_category: 'shares_info', display_order: 124 },
  { field_key: 'SC Status1', field_label: 'SC Status1', field_type: 'text', field_category: 'shares_info', display_order: 125 },
  { field_key: 'Year of Purchase1', field_label: 'Year of Purchase1', field_type: 'number', field_category: 'shares_info', display_order: 126 },
  // SC2-SC10 without Year of Purchase
  { field_key: 'SC2', field_label: 'SC2', field_type: 'text', field_category: 'shares_info', display_order: 127 },
  { field_key: 'DN2', field_label: 'DN2', field_type: 'text', field_category: 'shares_info', display_order: 128 },
  { field_key: 'NOS2', field_label: 'NOS2', field_type: 'text', field_category: 'shares_info', display_order: 129 },
  { field_key: 'SC Status2', field_label: 'SC Status2', field_type: 'text', field_category: 'shares_info', display_order: 130 },
  { field_key: 'SC3', field_label: 'SC3', field_type: 'text', field_category: 'shares_info', display_order: 131 },
  { field_key: 'DN3', field_label: 'DN3', field_type: 'text', field_category: 'shares_info', display_order: 132 },
  { field_key: 'NOS3', field_label: 'NOS3', field_type: 'text', field_category: 'shares_info', display_order: 133 },
  { field_key: 'SC Status3', field_label: 'SC Status3', field_type: 'text', field_category: 'shares_info', display_order: 134 },
  { field_key: 'SC4', field_label: 'SC4', field_type: 'text', field_category: 'shares_info', display_order: 135 },
  { field_key: 'DN4', field_label: 'DN4', field_type: 'text', field_category: 'shares_info', display_order: 136 },
  { field_key: 'NOS4', field_label: 'NOS4', field_type: 'text', field_category: 'shares_info', display_order: 137 },
  { field_key: 'SC Status4', field_label: 'SC Status4', field_type: 'text', field_category: 'shares_info', display_order: 138 },
  { field_key: 'SC5', field_label: 'SC5', field_type: 'text', field_category: 'shares_info', display_order: 139 },
  { field_key: 'DN5', field_label: 'DN5', field_type: 'text', field_category: 'shares_info', display_order: 140 },
  { field_key: 'NOS5', field_label: 'NOS5', field_type: 'text', field_category: 'shares_info', display_order: 141 },
  { field_key: 'SC Status5', field_label: 'SC Status5', field_type: 'text', field_category: 'shares_info', display_order: 142 },
  { field_key: 'SC6', field_label: 'SC6', field_type: 'text', field_category: 'shares_info', display_order: 143 },
  { field_key: 'DN6', field_label: 'DN6', field_type: 'text', field_category: 'shares_info', display_order: 144 },
  { field_key: 'NOS6', field_label: 'NOS6', field_type: 'text', field_category: 'shares_info', display_order: 145 },
  { field_key: 'SC Status6', field_label: 'SC Status6', field_type: 'text', field_category: 'shares_info', display_order: 146 },
  { field_key: 'SC7', field_label: 'SC7', field_type: 'text', field_category: 'shares_info', display_order: 147 },
  { field_key: 'DN7', field_label: 'DN7', field_type: 'text', field_category: 'shares_info', display_order: 148 },
  { field_key: 'NOS7', field_label: 'NOS7', field_type: 'text', field_category: 'shares_info', display_order: 149 },
  { field_key: 'SC Status7', field_label: 'SC Status7', field_type: 'text', field_category: 'shares_info', display_order: 150 },
  { field_key: 'SC8', field_label: 'SC8', field_type: 'text', field_category: 'shares_info', display_order: 151 },
  { field_key: 'DN8', field_label: 'DN8', field_type: 'text', field_category: 'shares_info', display_order: 152 },
  { field_key: 'NOS8', field_label: 'NOS8', field_type: 'text', field_category: 'shares_info', display_order: 153 },
  { field_key: 'SC Status8', field_label: 'SC Status8', field_type: 'text', field_category: 'shares_info', display_order: 154 },
  { field_key: 'SC9', field_label: 'SC9', field_type: 'text', field_category: 'shares_info', display_order: 155 },
  { field_key: 'DN9', field_label: 'DN9', field_type: 'text', field_category: 'shares_info', display_order: 156 },
  { field_key: 'NOS9', field_label: 'NOS9', field_type: 'text', field_category: 'shares_info', display_order: 157 },
  { field_key: 'SC Status9', field_label: 'SC Status9', field_type: 'text', field_category: 'shares_info', display_order: 158 },
  { field_key: 'SC10', field_label: 'SC10', field_type: 'text', field_category: 'shares_info', display_order: 159 },
  { field_key: 'DN10', field_label: 'DN10', field_type: 'text', field_category: 'shares_info', display_order: 160 },
  { field_key: 'NOS10', field_label: 'NOS10', field_type: 'text', field_category: 'shares_info', display_order: 161 },
  { field_key: 'SC Status10', field_label: 'SC Status10', field_type: 'text', field_category: 'shares_info', display_order: 162 },

  // Legal Heir Information (LH1-LH5)
  { field_key: 'Name as per Aadhar LH1', field_label: 'Name as per Aadhar LH1', field_type: 'text', field_category: 'legal_heir_info', display_order: 163 },
  { field_key: 'Name as per PAN LH1', field_label: 'Name as per PAN LH1', field_type: 'text', field_category: 'legal_heir_info', display_order: 164 },
  { field_key: 'Name as per Succession/Will LH1', field_label: 'Name as per Succession/Will LH1', field_type: 'text', field_category: 'legal_heir_info', display_order: 165 },
  { field_key: 'Father Name LH1', field_label: 'Father Name LH1', field_type: 'text', field_category: 'legal_heir_info', display_order: 166 },
  { field_key: 'Address LH1', field_label: 'Address LH1', field_type: 'text', field_category: 'legal_heir_info', display_order: 167 },
  { field_key: 'Mobile No LH1', field_label: 'Mobile No LH1', field_type: 'phone', field_category: 'legal_heir_info', display_order: 168 },
  { field_key: 'Relation LH1', field_label: 'Relation LH1', field_type: 'text', field_category: 'legal_heir_info', display_order: 169 },
  { field_key: 'Age LH1', field_label: 'Age LH1', field_type: 'number', field_category: 'legal_heir_info', display_order: 170 },

  { field_key: 'Name as per Aadhar LH2', field_label: 'Name as per Aadhar LH2', field_type: 'text', field_category: 'legal_heir_info', display_order: 171 },
  { field_key: 'Name as per PAN LH2', field_label: 'Name as per PAN LH2', field_type: 'text', field_category: 'legal_heir_info', display_order: 172 },
  { field_key: 'Name as per Succession/Will LH2', field_label: 'Name as per Succession/Will LH2', field_type: 'text', field_category: 'legal_heir_info', display_order: 173 },
  { field_key: 'Father Name LH2', field_label: 'Father Name LH2', field_type: 'text', field_category: 'legal_heir_info', display_order: 174 },
  { field_key: 'Address LH2', field_label: 'Address LH2', field_type: 'text', field_category: 'legal_heir_info', display_order: 175 },
  { field_key: 'Mobile No LH2', field_label: 'Mobile No LH2', field_type: 'phone', field_category: 'legal_heir_info', display_order: 176 },
  { field_key: 'Relation LH2', field_label: 'Relation LH2', field_type: 'text', field_category: 'legal_heir_info', display_order: 177 },
  { field_key: 'Age LH2', field_label: 'Age LH2', field_type: 'number', field_category: 'legal_heir_info', display_order: 178 },

  { field_key: 'Name as per Aadhar LH3', field_label: 'Name as per Aadhar LH3', field_type: 'text', field_category: 'legal_heir_info', display_order: 179 },
  { field_key: 'Name as per PAN LH3', field_label: 'Name as per PAN LH3', field_type: 'text', field_category: 'legal_heir_info', display_order: 180 },
  { field_key: 'Name as per Succession/Will LH3', field_label: 'Name as per Succession/Will LH3', field_type: 'text', field_category: 'legal_heir_info', display_order: 181 },
  { field_key: 'Father Name LH3', field_label: 'Father Name LH3', field_type: 'text', field_category: 'legal_heir_info', display_order: 182 },
  { field_key: 'Address LH3', field_label: 'Address LH3', field_type: 'text', field_category: 'legal_heir_info', display_order: 183 },
  { field_key: 'Mobile No LH3', field_label: 'Mobile No LH3', field_type: 'phone', field_category: 'legal_heir_info', display_order: 184 },
  { field_key: 'Relation LH3', field_label: 'Relation LH3', field_type: 'text', field_category: 'legal_heir_info', display_order: 185 },
  { field_key: 'Age LH3', field_label: 'Age LH3', field_type: 'number', field_category: 'legal_heir_info', display_order: 186 },

  { field_key: 'Name as per Aadhar LH4', field_label: 'Name as per Aadhar LH4', field_type: 'text', field_category: 'legal_heir_info', display_order: 187 },
  { field_key: 'Name as per PAN LH4', field_label: 'Name as per PAN LH4', field_type: 'text', field_category: 'legal_heir_info', display_order: 188 },
  { field_key: 'Name as per Succession/Will LH4', field_label: 'Name as per Succession/Will LH4', field_type: 'text', field_category: 'legal_heir_info', display_order: 189 },
  { field_key: 'Father Name LH4', field_label: 'Father Name LH4', field_type: 'text', field_category: 'legal_heir_info', display_order: 190 },
  { field_key: 'Address LH4', field_label: 'Address LH4', field_type: 'text', field_category: 'legal_heir_info', display_order: 191 },
  { field_key: 'Mobile No LH4', field_label: 'Mobile No LH4', field_type: 'phone', field_category: 'legal_heir_info', display_order: 192 },
  { field_key: 'Relation LH4', field_label: 'Relation LH4', field_type: 'text', field_category: 'legal_heir_info', display_order: 193 },
  { field_key: 'Age LH4', field_label: 'Age LH4', field_type: 'number', field_category: 'legal_heir_info', display_order: 194 },

  { field_key: 'Name as per Aadhar LH5', field_label: 'Name as per Aadhar LH5', field_type: 'text', field_category: 'legal_heir_info', display_order: 195 },
  { field_key: 'Name as per PAN LH5', field_label: 'Name as per PAN LH5', field_type: 'text', field_category: 'legal_heir_info', display_order: 196 },
  { field_key: 'Name as per Succession/Will LH5', field_label: 'Name as per Succession/Will LH5', field_type: 'text', field_category: 'legal_heir_info', display_order: 197 },
  { field_key: 'Father Name LH5', field_label: 'Father Name LH5', field_type: 'text', field_category: 'legal_heir_info', display_order: 198 },
  { field_key: 'Address LH5', field_label: 'Address LH5', field_type: 'text', field_category: 'legal_heir_info', display_order: 199 },
  { field_key: 'Mobile No LH5', field_label: 'Mobile No LH5', field_type: 'phone', field_category: 'legal_heir_info', display_order: 200 },
  { field_key: 'Relation LH5', field_label: 'Relation LH5', field_type: 'text', field_category: 'legal_heir_info', display_order: 201 },
  { field_key: 'Age LH5', field_label: 'Age LH5', field_type: 'number', field_category: 'legal_heir_info', display_order: 202 },

  { field_key: 'Name as per Aadhar LH6', field_label: 'Name as per Aadhar LH6', field_type: 'text', field_category: 'legal_heir_info', display_order: 203 },
  { field_key: 'Name as per PAN LH6', field_label: 'Name as per PAN LH6', field_type: 'text', field_category: 'legal_heir_info', display_order: 204 },
  { field_key: 'Name as per Succession/Will LH6', field_label: 'Name as per Succession/Will LH6', field_type: 'text', field_category: 'legal_heir_info', display_order: 205 },
  { field_key: 'Father Name LH6', field_label: 'Father Name LH6', field_type: 'text', field_category: 'legal_heir_info', display_order: 206 },
  { field_key: 'Address LH6', field_label: 'Address LH6', field_type: 'text', field_category: 'legal_heir_info', display_order: 207 },
  { field_key: 'Mobile No LH6', field_label: 'Mobile No LH6', field_type: 'phone', field_category: 'legal_heir_info', display_order: 208 },
  { field_key: 'Relation LH6', field_label: 'Relation LH6', field_type: 'text', field_category: 'legal_heir_info', display_order: 209 },
  { field_key: 'Age LH6', field_label: 'Age LH6', field_type: 'number', field_category: 'legal_heir_info', display_order: 210 },

  { field_key: 'Name as per Aadhar LH7', field_label: 'Name as per Aadhar LH7', field_type: 'text', field_category: 'legal_heir_info', display_order: 211 },
  { field_key: 'Name as per PAN LH7', field_label: 'Name as per PAN LH7', field_type: 'text', field_category: 'legal_heir_info', display_order: 212 },
  { field_key: 'Name as per Succession/Will LH7', field_label: 'Name as per Succession/Will LH7', field_type: 'text', field_category: 'legal_heir_info', display_order: 213 },
  { field_key: 'Father Name LH7', field_label: 'Father Name LH7', field_type: 'text', field_category: 'legal_heir_info', display_order: 214 },
  { field_key: 'Address LH7', field_label: 'Address LH7', field_type: 'text', field_category: 'legal_heir_info', display_order: 215 },
  { field_key: 'Mobile No LH7', field_label: 'Mobile No LH7', field_type: 'phone', field_category: 'legal_heir_info', display_order: 216 },
  { field_key: 'Relation LH7', field_label: 'Relation LH7', field_type: 'text', field_category: 'legal_heir_info', display_order: 217 },
  { field_key: 'Age LH7', field_label: 'Age LH7', field_type: 'number', field_category: 'legal_heir_info', display_order: 218 },

  { field_key: 'Name as per Aadhar LH8', field_label: 'Name as per Aadhar LH8', field_type: 'text', field_category: 'legal_heir_info', display_order: 219 },
  { field_key: 'Name as per PAN LH8', field_label: 'Name as per PAN LH8', field_type: 'text', field_category: 'legal_heir_info', display_order: 220 },
  { field_key: 'Name as per Succession/Will LH8', field_label: 'Name as per Succession/Will LH8', field_type: 'text', field_category: 'legal_heir_info', display_order: 221 },
  { field_key: 'Father Name LH8', field_label: 'Father Name LH8', field_type: 'text', field_category: 'legal_heir_info', display_order: 222 },
  { field_key: 'Address LH8', field_label: 'Address LH8', field_type: 'text', field_category: 'legal_heir_info', display_order: 223 },
  { field_key: 'Mobile No LH8', field_label: 'Mobile No LH8', field_type: 'phone', field_category: 'legal_heir_info', display_order: 224 },
  { field_key: 'Relation LH8', field_label: 'Relation LH8', field_type: 'text', field_category: 'legal_heir_info', display_order: 225 },
  { field_key: 'Age LH8', field_label: 'Age LH8', field_type: 'number', field_category: 'legal_heir_info', display_order: 226 },

  { field_key: 'Name as per Aadhar LH9', field_label: 'Name as per Aadhar LH9', field_type: 'text', field_category: 'legal_heir_info', display_order: 227 },
  { field_key: 'Name as per PAN LH9', field_label: 'Name as per PAN LH9', field_type: 'text', field_category: 'legal_heir_info', display_order: 228 },
  { field_key: 'Name as per Succession/Will LH9', field_label: 'Name as per Succession/Will LH9', field_type: 'text', field_category: 'legal_heir_info', display_order: 229 },
  { field_key: 'Father Name LH9', field_label: 'Father Name LH9', field_type: 'text', field_category: 'legal_heir_info', display_order: 230 },
  { field_key: 'Address LH9', field_label: 'Address LH9', field_type: 'text', field_category: 'legal_heir_info', display_order: 231 },
  { field_key: 'Mobile No LH9', field_label: 'Mobile No LH9', field_type: 'phone', field_category: 'legal_heir_info', display_order: 232 },
  { field_key: 'Relation LH9', field_label: 'Relation LH9', field_type: 'text', field_category: 'legal_heir_info', display_order: 233 },
  { field_key: 'Age LH9', field_label: 'Age LH9', field_type: 'number', field_category: 'legal_heir_info', display_order: 234 },

  { field_key: 'Name as per Aadhar LH10', field_label: 'Name as per Aadhar LH10', field_type: 'text', field_category: 'legal_heir_info', display_order: 235 },
  { field_key: 'Name as per PAN LH10', field_label: 'Name as per PAN LH10', field_type: 'text', field_category: 'legal_heir_info', display_order: 236 },
  { field_key: 'Name as per Succession/Will LH10', field_label: 'Name as per Succession/Will LH10', field_type: 'text', field_category: 'legal_heir_info', display_order: 237 },
  { field_key: 'Father Name LH10', field_label: 'Father Name LH10', field_type: 'text', field_category: 'legal_heir_info', display_order: 238 },
  { field_key: 'Address LH10', field_label: 'Address LH10', field_type: 'text', field_category: 'legal_heir_info', display_order: 239 },
  { field_key: 'Mobile No LH10', field_label: 'Mobile No LH10', field_type: 'phone', field_category: 'legal_heir_info', display_order: 240 },
  { field_key: 'Relation LH10', field_label: 'Relation LH10', field_type: 'text', field_category: 'legal_heir_info', display_order: 241 },
  { field_key: 'Age LH10', field_label: 'Age LH10', field_type: 'number', field_category: 'legal_heir_info', display_order: 242 },

  // Additional Information
  { field_key: 'Date of Issue', field_label: 'Date of Issue', field_type: 'date', field_category: 'additional_info', display_order: 243 }
];

async function populateCaseFields() {
  try {
    console.log('Starting to populate case fields...');
    
    for (const fieldData of caseFieldsData) {
      const [field, created] = await CaseField.findOrCreate({
        where: { field_key: fieldData.field_key },
        defaults: fieldData
      });
      
      if (created) {
        console.log(`Created: ${fieldData.field_key}`);
      } else {
        console.log(`Already exists: ${fieldData.field_key}`);
      }
    }
    
    console.log('Case fields population completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error populating case fields:', error);
    process.exit(1);
  }
}

// Run the script
populateCaseFields();
