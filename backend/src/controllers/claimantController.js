const { Claimant, Company, User } = require('../models');

// Get all claimants for a company
const getClaimantsByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Check if company exists
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const claimants = await Claimant.findAll({
      where: { company_id: companyId },
      include: [
        {
          model: User,
          as: 'createdByUser',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'lastUpdatedByUser',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['claimant_number', 'ASC']]
    });

    res.json({ claimants });
  } catch (error) {
    console.error('Error fetching claimants:', error);
    res.status(500).json({ error: 'Failed to fetch claimants' });
  }
};

// Create a new claimant for a company
const createClaimant = async (req, res) => {
  try {
    const { companyId } = req.params;
    const claimantData = req.body;
    const created_by = req.user.id;

    // Check if company exists
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get the next claimant number
    const lastClaimant = await Claimant.findOne({
      where: { company_id: companyId },
      order: [['claimant_number', 'DESC']]
    });
    
    const claimant_number = lastClaimant ? lastClaimant.claimant_number + 1 : 1;

    // Create the claimant
    const claimant = await Claimant.create({
      ...claimantData,
      company_id: companyId,
      claimant_number,
      created_by
    });

    // Fetch the created claimant with user details
    const createdClaimant = await Claimant.findByPk(claimant.id, {
      include: [
        {
          model: User,
          as: 'createdByUser',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.status(201).json({ 
      message: 'Claimant created successfully',
      claimant: createdClaimant 
    });
  } catch (error) {
    console.error('Error creating claimant:', error);
    res.status(500).json({ error: 'Failed to create claimant' });
  }
};

// Get claimant details
const getClaimantDetails = async (req, res) => {
  try {
    const { claimantId } = req.params;
    
    const claimant = await Claimant.findByPk(claimantId, {
      include: [
        {
          model: User,
          as: 'createdByUser',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'lastUpdatedByUser',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'company_name', 'case_id']
        }
      ]
    });

    if (!claimant) {
      return res.status(404).json({ error: 'Claimant not found' });
    }

    res.json({ claimant });
  } catch (error) {
    console.error('Error fetching claimant details:', error);
    res.status(500).json({ error: 'Failed to fetch claimant details' });
  }
};

// Update claimant details
const updateClaimant = async (req, res) => {
  try {
    const { claimantId } = req.params;
    const updateData = req.body;
    const last_updated_by = req.user.id;

    const claimant = await Claimant.findByPk(claimantId);
    if (!claimant) {
      return res.status(404).json({ error: 'Claimant not found' });
    }

    // Update the claimant
    await claimant.update({
      ...updateData,
      last_updated_by
    });

    // Fetch the updated claimant with user details
    const updatedClaimant = await Claimant.findByPk(claimantId, {
      include: [
        {
          model: User,
          as: 'createdByUser',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'lastUpdatedByUser',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.json({ 
      message: 'Claimant updated successfully',
      claimant: updatedClaimant 
    });
  } catch (error) {
    console.error('Error updating claimant:', error);
    res.status(500).json({ error: 'Failed to update claimant' });
  }
};

// Delete claimant
const deleteClaimant = async (req, res) => {
  try {
    const { claimantId } = req.params;

    const claimant = await Claimant.findByPk(claimantId);
    if (!claimant) {
      return res.status(404).json({ error: 'Claimant not found' });
    }

    await claimant.destroy();

    res.json({ message: 'Claimant deleted successfully' });
  } catch (error) {
    console.error('Error deleting claimant:', error);
    res.status(500).json({ error: 'Failed to delete claimant' });
  }
};

// Reorder claimants (update claimant numbers)
const reorderClaimants = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { claimantIds } = req.body; // Array of claimant IDs in new order

    // Check if company exists
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Update claimant numbers based on the new order
    for (let i = 0; i < claimantIds.length; i++) {
      await Claimant.update(
        { claimant_number: i + 1 },
        { where: { id: claimantIds[i], company_id: companyId } }
      );
    }

    res.json({ message: 'Claimants reordered successfully' });
  } catch (error) {
    console.error('Error reordering claimants:', error);
    res.status(500).json({ error: 'Failed to reorder claimants' });
  }
};

module.exports = {
  getClaimantsByCompany,
  createClaimant,
  getClaimantDetails,
  updateClaimant,
  deleteClaimant,
  reorderClaimants
};
