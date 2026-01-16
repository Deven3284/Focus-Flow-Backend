const jwt = require('jsonwebtoken');
const models = require('./../models/zindex');
const response = require('./../utils/response')

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const decodedData = jwt.verify(token, process.env.JWT_SECRET);
    let result = await models.User.countDocuments({ _id: decodedData.id, isActive: true });
    if (result == 0) { return response.unauthorized(res); }
    req.userId = decodedData.id;
    req.userRole = decodedData.role;
    next();
  } catch (error) {
    return response.unauthorized(res);
  }
};

const adminCheck = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return response.forbidden('', res);
  }
  next();
};

module.exports = { authMiddleware, adminCheck };