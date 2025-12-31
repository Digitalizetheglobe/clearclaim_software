const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Case } = require('../models');
const { auth, requireRole } = require('../middleware/auth');
const { sequelize } = require('../config/database');

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

    // Convert role to array if it's a string (for backward compatibility)
    const rolesArray = Array.isArray(role) ? role : (role ? [role] : ['employee']);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: rolesArray
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

    // Ensure role is an array (for backward compatibility with old single-role users)
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: userRoles },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: userRoles,
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
      // Normalize role to array (for backward compatibility)
      const userRoles = Array.isArray(user.role) ? user.role : [user.role];
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: userRoles,
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
    // Normalize role to array (for backward compatibility)
    const userRoles = Array.isArray(user.role) ? user.role : [user.role];

    const formattedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: userRoles,
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

// Update user (Admin only)
router.put('/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if email is being changed and if it already exists
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists.' });
      }
    }

    // Update user fields
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    
    // Handle role update
    if (role !== undefined) {
      // Convert role to array if it's a string
      const rolesArray = Array.isArray(role) ? role : [role];
      
      // Validate roles
      const validRoles = ['admin', 'sales', 'employee', 'data_reviewer', 'template_reviewer'];
      const invalidRoles = rolesArray.filter(r => !validRoles.includes(r));
      if (invalidRoles.length > 0) {
        return res.status(400).json({ 
          error: `Invalid role(s): ${invalidRoles.join(', ')}. Valid roles are: ${validRoles.join(', ')}` 
        });
      }
      
      // Use raw SQL to update JSONB column - this ensures proper JSONB handling
      try {
        const [results] = await sequelize.query(
          `UPDATE users SET role = $1::jsonb WHERE id = $2 RETURNING id`,
          {
            bind: [JSON.stringify(rolesArray), parseInt(id)],
            type: sequelize.QueryTypes.UPDATE
          }
        );
        console.log(`✅ Updated role for user ${id} to:`, rolesArray);
      } catch (roleError) {
        console.error('Role update error:', roleError);
        // If raw SQL fails, the column might still be ENUM - provide helpful error
        throw new Error(`Role update failed. Database column may need migration. Error: ${roleError.message}`);
      }
    }

    // Update other fields (name, email) if role was updated via raw SQL
    if (Object.keys(updateData).length > 0) {
      await user.update(updateData);
    }

    // Fetch updated user with case details
    const updatedUser = await User.findByPk(id, {
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
      ]
    });

    const assignedCases = updatedUser.assignedCases || [];
    const createdCases = updatedUser.createdCases || [];
    // Normalize role to array (for backward compatibility)
    const userRoles = Array.isArray(updatedUser.role) ? updatedUser.role : [updatedUser.role];

    const formattedUser = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: userRoles,
      avatar: updatedUser.avatar,
      last_login: updatedUser.last_login,
      created_at: updatedUser.created_at,
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

    res.json({
      message: 'User updated successfully',
      user: formattedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      original: error.original
    });
    
    // Check if error is related to role column type
    const errorMessage = error.message || '';
    const isRoleTypeError = errorMessage.includes('role') || 
                            errorMessage.includes('ENUM') || 
                            errorMessage.includes('jsonb') ||
                            (error.original && error.original.message && error.original.message.includes('role'));
    
    if (isRoleTypeError) {
      return res.status(500).json({ 
        error: 'Failed to update user role. The database column may need to be migrated to JSONB.',
        hint: 'Please run: node backend/migrate-role-column-to-jsonb.js',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to update user.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete user (Admin only)
router.delete('/:id', auth, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Prevent self-deletion
    const currentUserId = req.user?.id;
    if (currentUserId && parseInt(id) === parseInt(currentUserId)) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    await user.destroy();

    res.json({ 
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      error: 'Failed to delete user.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
      // Normalize role to array (for backward compatibility)
      const userRoles = Array.isArray(user.role) ? user.role : [user.role];
      
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: userRoles,
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
