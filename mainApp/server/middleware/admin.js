/**
 * Admin middleware — ensures req.user.role is 'admin'.
 * Must be used AFTER the 'protect' middleware.
 */
module.exports = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Admin privileges required' });
  }
};
