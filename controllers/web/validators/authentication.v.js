const joi = require('joi');

exports.signIn = joi.object().keys({
    email: joi.string().email().required(),
    password: joi.string().required()
});

exports.createUser = joi.object().keys({
    _id: joi.string().allow('').optional(),
    name: joi.string().required(),
    mobile: joi.string().required(),
    email: joi.string().required(),
    password: joi.string().allow('').required(),
    role: joi.string().required(),
    jobTitle: joi.string().allow('').optional(),
    workType: joi.string().allow('').optional(),
    status: joi.string().allow('').optional(),
    isActive: joi.boolean().optional()
}).unknown(true);