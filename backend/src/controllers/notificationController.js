const { Notification, User, Company, Case } = require('../models');

// Get all notifications for current user
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { is_read, limit = 50 } = req.query;

    const whereClause = { user_id: userId };
    if (is_read !== undefined) {
      whereClause.is_read = is_read === 'true';
    }

    const notifications = await Notification.findAll({
      where: whereClause,
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'company_name'],
          include: [{
            model: Case,
            as: 'case',
            attributes: ['id', 'case_id', 'case_title', 'client_name']
          }]
        },
        {
          model: Case,
          as: 'case',
          attributes: ['id', 'case_id', 'case_title', 'client_name']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit)
    });

    // Get unread count
    const unreadCount = await Notification.count({
      where: {
        user_id: userId,
        is_read: false
      }
    });

    res.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        user_id: userId
      }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await notification.update({
      is_read: true,
      read_at: new Date()
    });

    res.json({
      message: 'Notification marked as read',
      notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.update(
      {
        is_read: true,
        read_at: new Date()
      },
      {
        where: {
          user_id: userId,
          is_read: false
        }
      }
    );

    res.json({
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};

// Get unread count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await Notification.count({
      where: {
        user_id: userId,
        is_read: false
      }
    });

    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

// Create notification (helper function for other controllers)
const createNotification = async (userId, type, title, message, companyId = null, caseId = null, metadata = null) => {
  try {
    const notification = await Notification.create({
      user_id: userId,
      company_id: companyId,
      case_id: caseId,
      type,
      title,
      message,
      metadata
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  createNotification
};

