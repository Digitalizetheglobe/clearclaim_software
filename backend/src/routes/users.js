const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Case } = require('../models');

const router = express.Router();

// User Registration
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'employee'
    });

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// User Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials.' });
    }

    // Update last login
    await user.update({ last_login: new Date() });

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

// Get all users with their assigned cases
router.get('/', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Case,
          as: 'assignedCases',
          attributes: ['id', 'case_id', 'case_title', 'status', 'client_name', 'created_at'],
          required: false
        },
        {
          model: Case,
          as: 'createdCases',
          attributes: ['id', 'case_id', 'case_title', 'status', 'client_name', 'created_at'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Format the response to include case counts and details
    const formattedUsers = users.map(user => {
      const assignedCases = user.assignedCases || [];
      const createdCases = user.createdCases || [];
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        last_login: user.last_login,
        created_at: user.created_at,
        caseStats: {
          totalAssigned: assignedCases.length,
          totalCreated: createdCases.length,
          activeAssigned: assignedCases.filter(c => c.status === 'active').length,
          completedAssigned: assignedCases.filter(c => c.status === 'completed').length,
          pendingAssigned: assignedCases.filter(c => c.status === 'pending').length
        },
        assignedCases: assignedCases.map(caseItem => ({
          id: caseItem.id,
          case_id: caseItem.case_id,
          case_title: caseItem.case_title,
          status: caseItem.status,
          client_name: caseItem.client_name,
          created_at: caseItem.created_at
        })),
        createdCases: createdCases.map(caseItem => ({
          id: caseItem.id,
          case_id: caseItem.case_id,
          case_title: caseItem.case_title,
          status: caseItem.status,
          client_name: caseItem.client_name,
          created_at: caseItem.created_at
        }))
      };
    });

    res.json({ 
      users: formattedUsers,
      total: formattedUsers.length,
      message: 'Users fetched successfully with case details'
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users with case details.' });
  }
});

// Get user by ID with case details
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Case,
          as: 'assignedCases',
          attributes: ['id', 'case_id', 'case_title', 'status', 'client_name', 'client_email', 'client_mobile', 'created_at'],
          required: false
        },
        {
          model: Case,
          as: 'createdCases',
          attributes: ['id', 'case_id', 'case_title', 'status', 'client_name', 'client_email', 'client_mobile', 'created_at'],
          required: false
        }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const assignedCases = user.assignedCases || [];
    const createdCases = user.createdCases || [];

    const formattedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      last_login: user.last_login,
      created_at: user.created_at,
      caseStats: {
        totalAssigned: assignedCases.length,
        totalCreated: createdCases.length,
        activeAssigned: assignedCases.filter(c => c.status === 'active').length,
        completedAssigned: assignedCases.filter(c => c.status === 'completed').length,
        pendingAssigned: assignedCases.filter(c => c.status === 'pending').length
      },
      assignedCases: assignedCases.map(caseItem => ({
        id: caseItem.id,
        case_id: caseItem.case_id,
        case_title: caseItem.case_title,
        status: caseItem.status,
        client_name: caseItem.client_name,
        client_email: caseItem.client_email,
        client_mobile: caseItem.client_mobile,
        created_at: caseItem.created_at
      })),
      createdCases: createdCases.map(caseItem => ({
        id: caseItem.id,
        case_id: caseItem.case_id,
        case_title: caseItem.case_title,
        status: caseItem.status,
        client_name: caseItem.client_name,
        client_email: caseItem.client_email,
        client_mobile: caseItem.client_mobile,
        created_at: caseItem.created_at
      }))
    };

    res.json({ 
      user: formattedUser,
      message: 'User fetched successfully with case details'
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user with case details.' });
  }
});

// Get users with case summary (for dashboard)
router.get('/summary/cases', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'email', 'role'],
      include: [
        {
          model: Case,
          as: 'assignedCases',
          attributes: ['status'],
          required: false
        }
      ]
    });

    const userCaseSummary = users.map(user => {
      const assignedCases = user.assignedCases || [];
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        caseSummary: {
          total: assignedCases.length,
          active: assignedCases.filter(c => c.status === 'active').length,
          completed: assignedCases.filter(c => c.status === 'completed').length,
          pending: assignedCases.filter(c => c.status === 'pending').length
        }
      };
    });

    res.json({ 
      userCaseSummary,
      total: userCaseSummary.length
    });
  } catch (error) {
    console.error('Get user case summary error:', error);
    res.status(500).json({ error: 'Failed to fetch user case summary.' });
  }
});

module.exports = router;
