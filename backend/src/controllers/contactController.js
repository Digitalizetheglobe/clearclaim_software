const { Contact } = require('../models');

exports.create = async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, city } = req.body;

    if (!firstName || !lastName || !phoneNumber || !city) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['firstName', 'lastName', 'phoneNumber', 'city']
      });
    }

    const contact = await Contact.create({
      firstName,
      lastName,
      phoneNumber,
      city
    });

    res.status(201).json({
      message: 'Contact created successfully',
      contact: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phoneNumber: contact.phoneNumber,
        city: contact.city,
        createdAt: contact.createdAt
      }
    });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
};

exports.list = async (req, res) => {
  try {
    const contacts = await Contact.findAll({
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'firstName', 'lastName', 'phoneNumber', 'city', 'createdAt', 'updatedAt']
    });
    res.json({ contacts });
  } catch (error) {
    console.error('List contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
};

exports.getById = async (req, res) => {
  try {
    const contact = await Contact.findByPk(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ contact });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
};
