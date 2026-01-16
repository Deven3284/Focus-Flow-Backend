const models = require('./../../models/zindex');
const response = require('./../../utils/response');
const asyncHandler = require("express-async-handler");

// Create new SOP document (Admin/HR only)
exports.createSOP = asyncHandler(async (req, res) => {
    const { title, description, content, assignedTo, priority } = req.body;

    if (!title || !content || !assignedTo) {
        return response.success("Title, content, and assigned user are required", null, res);
    }

    const sop = await models.SOP.create({
        title,
        description: description || '',
        content,
        assignedTo,
        createdBy: req.userId,
        priority: priority || 'medium',
        status: 'pending'
    });

    // Populate the created SOP with user details
    const populatedSOP = await models.SOP.findById(sop._id)
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name');

    return response.success("SOP document created successfully", populatedSOP, res);
});

// Get all SOPs (Admin sees all, User sees only theirs)
exports.getSOPs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, assignedTo } = req.body;
    const userRole = req.userRole;

    let query = {};

    // If not admin, only show SOPs assigned to the current user
    if (userRole !== 'admin' && userRole !== 'hr') {
        query.assignedTo = req.userId;
    } else if (assignedTo) {
        // Admin can filter by specific user
        query.assignedTo = assignedTo;
    }

    if (status) {
        query.status = status;
    }

    const sops = await models.SOP.find(query)
        .populate('assignedTo', 'name email role')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const total = await models.SOP.countDocuments(query);

    return response.success("SOPs retrieved successfully", {
        docs: sops,
        total,
        page,
        pages: Math.ceil(total / limit)
    }, res);
});

// Get single SOP by ID
exports.getSOPById = asyncHandler(async (req, res) => {
    const { id } = req.body;

    if (!id) {
        return response.success("SOP ID is required", null, res);
    }

    const sop = await models.SOP.findById(id)
        .populate('assignedTo', 'name email role')
        .populate('createdBy', 'name')
        .lean();

    if (!sop) {
        return response.success("SOP not found", null, res);
    }

    // Check if user has access (admin/hr can see all, users can only see their own)
    const userRole = req.userRole;
    if (userRole !== 'admin' && userRole !== 'hr') {
        if (String(sop.assignedTo._id) !== String(req.userId)) {
            return response.success("You don't have permission to view this SOP", null, res);
        }
    }

    // Mark as read if this is the assigned user viewing it
    if (String(sop.assignedTo._id) === String(req.userId) && !sop.isRead) {
        await models.SOP.findByIdAndUpdate(id, { isRead: true });
        sop.isRead = true;
    }

    return response.success("SOP retrieved successfully", sop, res);
});

// Update SOP (Admin/HR only)
exports.updateSOP = asyncHandler(async (req, res) => {
    const { id, title, description, content, priority, status } = req.body;

    if (!id) {
        return response.success("SOP ID is required", null, res);
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (content) updateData.content = content;
    if (priority) updateData.priority = priority;
    if (status) updateData.status = status;

    const sop = await models.SOP.findByIdAndUpdate(id, updateData, { new: true })
        .populate('assignedTo', 'name email')
        .populate('createdBy', 'name');

    if (!sop) {
        return response.success("SOP not found", null, res);
    }

    return response.success("SOP updated successfully", sop, res);
});

// Delete SOP (Admin/HR only)
exports.deleteSOP = asyncHandler(async (req, res) => {
    const { id } = req.body;

    if (!id) {
        return response.success("SOP ID is required", null, res);
    }

    const sop = await models.SOP.findByIdAndDelete(id);

    if (!sop) {
        return response.success("SOP not found", null, res);
    }

    return response.success("SOP deleted successfully", true, res);
});

// User acknowledges SOP
exports.acknowledgeSOP = asyncHandler(async (req, res) => {
    const { id } = req.body;

    if (!id) {
        return response.success("SOP ID is required", null, res);
    }

    const sop = await models.SOP.findById(id);

    if (!sop) {
        return response.success("SOP not found", null, res);
    }

    // Check if user is the assigned user
    if (String(sop.assignedTo) !== String(req.userId)) {
        return response.success("You can only acknowledge SOPs assigned to you", null, res);
    }

    sop.status = 'acknowledged';
    sop.acknowledgedAt = new Date();
    sop.isRead = true;
    await sop.save();

    return response.success("SOP acknowledged successfully", sop, res);
});

// Get unread SOP count for notifications (for current user)
exports.getUnreadSOPCount = asyncHandler(async (req, res) => {
    const count = await models.SOP.countDocuments({
        assignedTo: req.userId,
        isRead: false
    });

    return response.success("Unread SOP count retrieved", { count }, res);
});
