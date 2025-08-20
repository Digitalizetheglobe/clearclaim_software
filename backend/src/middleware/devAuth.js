// Development authentication middleware - REMOVE IN PRODUCTION
const devAuth = (req, res, next) => {
  // Set a default user for development/testing
  req.user = {
    id: 1,
    name: 'Dev User',
    email: 'dev@example.com',
    role: 'admin'
  };
  next();
};

module.exports = devAuth;
