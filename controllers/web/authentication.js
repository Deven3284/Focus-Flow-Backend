const mongoose = require('mongoose');
const moment = require('moment-timezone');
const models = require('./../../models/zindex');
const helper = require('./../../utils/helper');
const response = require('./../../utils/response');
const { decrypt, encrypt } = require('./../../utils/encryption');
const asyncHandler = require("express-async-handler");

const validators = require('./validators/authentication.v');

exports.getDashboard = asyncHandler(async (req, res) => {
    const userId = req.userId;

    // Get total tasks count
    const totalTasks = await models.DailyStatus.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId)
            }
        },
        { $unwind: '$tasks' },
        { $count: 'totalTasks' }
    ]);

    // Get completed tasks count
    const completedTasks = await models.DailyStatus.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId)
            }
        },
        { $unwind: '$tasks' },
        { $match: { 'tasks.status': 'Completed' } },
        { $count: 'completedTasks' }
    ]);

    // Get pending tasks count
    const pendingTasks = await models.DailyStatus.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId)
            }
        },
        { $unwind: '$tasks' },
        { $match: { 'tasks.status': 'Pending' } },
        { $count: 'pendingTasks' }
    ]);

    // Get in-progress tasks count
    const inProgressTasks = await models.DailyStatus.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId)
            }
        },
        { $unwind: '$tasks' },
        { $match: { 'tasks.status': 'In Progress' } },
        { $count: 'inProgressTasks' }
    ]);

    let users = 0;
    if (req.userRole == 'admin') {
        users = await models.User.countDocuments({ role: { $ne: "admin" } });
    }

    return response.success("Dashboard data retrieved successfully", {
        totalTasks: totalTasks.length == 1 ? totalTasks[0].totalTasks : 0,
        completedTasks: completedTasks.length == 1 ? completedTasks[0].completedTasks : 0,
        pendingTasks: pendingTasks.length == 1 ? pendingTasks[0].pendingTasks : 0,
        inProgressTasks: inProgressTasks.length == 1 ? inProgressTasks[0].inProgressTasks : 0,
        users: users
    }, res);
});

exports.getDeveloperReport = asyncHandler(async (req, res) => {
    const { workType, reportDate } = req.body;
    if (req.userRole == "admin") {
        let startTime = reportDate != null && reportDate != "" ? moment.utc(reportDate).tz('Asia/Kolkata').startOf('day').toDate() : moment().startOf('day').toDate();
        let endTime = reportDate != null && reportDate != "" ? moment.utc(reportDate).tz('Asia/Kolkata').endOf('day').toDate() : moment().endOf('day').toDate();

        // Build query for developers - filter by workType if provided
        let developerQuery = { role: 'developer', isActive: true };
        if (workType != null && workType != "" && workType.toLowerCase() !== 'all') {
            developerQuery.workType = workType;
        }

        let developers = await models.User.find(developerQuery).select('name mobile jobTitle isActive workType').lean();
        const dailyStatus = await models.DailyStatus.find({ date: { $gte: startTime, $lte: endTime } })
            .populate({ path: 'tasks.task', select: 'title priority' })
            .lean();

        for (let dev of developers) {
            const devId = dev._id;
            let hasResult = dailyStatus.filter((e) => String(e.user) == (devId));
            dev.startTime = hasResult.length > 0 ? moment.utc(hasResult[0].startTime).tz('Asia/Kolkata').format('MMM D, YYYY h:mm A') : '-';
            dev.endTime = hasResult.length > 0 ? hasResult[0].endTime != null ? moment.utc(hasResult[0].endTime).tz('Asia/Kolkata').format('MMM D, YYYY h:mm A') : '-' : '-';

            dev.totalTime = String(dev.startTime).includes('-') || (dev.endTime != null && String(dev.endTime).includes('-')) ? '-' : helper.formatTime(dev.startTime, dev.endTime);
            dev.tasks = hasResult.length > 0 ? hasResult[0].tasks : [];
            dev.dailyStatusId = hasResult.length > 0 ? hasResult[0]._id : null;
            dev.tasks = dev.tasks.map((e) => {
                // Task is a string in schema (Title) or might be populated. Handle both.
                // Priority/Status are directly on the task subdocument.
                const taskTitle = (e.task && typeof e.task === 'object' && e.task.title) ? e.task.title : e.task;

                return {
                    ...e,
                    title: taskTitle || 'Unknown Task',
                    priority: e.priority || 'Medium',
                    status: e.status || 'not-started',
                    initalStartedTime: (e.initalStartedTime && e.initalStartedTime !== "") ? moment.utc(e.initalStartedTime).tz('Asia/Kolkata').format('MMM D, YYYY h:mm A') : '-',
                    endedTime: (e.endedTime && e.endedTime !== "") ? moment.utc(e.endedTime).tz('Asia/Kolkata').format('MMM D, YYYY h:mm A') : '-'
                };
            })
        }
        return response.success("Developers' today's report retrieved successfully", developers, res);
    }
    else {
        return response.success("Unauthorized access to developer report", [], res);
    }
});

exports.signIn = asyncHandler(async (req, res) => {

    const { error, value } = validators.signIn.validate(req.body);
    if (error) {
        return response.success(error.message, null, res);
    }

    let result = await models.User.findOne({ email: value.email }).lean();
    if (!result) {
        return response.success("Invalid email or password", null, res);
    }

    if (!result.isActive) { return response.success("Your account is deactive! Contact Admin", null, res); }

    let plainText = decrypt(result.password);
    if (plainText == value.password) {
        let object = {
            id: result._id,
            name: result.name,
            role: result.role,
            email: result.email,
            jobTitle: result.jobTitle,
            profileImage: result.profileImage,
            workType: result.workType
        };
        object.token = helper.generateToken({ id: result._id, role: result.role });
        return response.success("Logged in successfully", Object.seal(object), res);
    } else {
        return response.success("Invalid email or password", null, res);
    }
});

exports.saveUser = asyncHandler(async (req, res) => {
    let { error, value } = validators.createUser.validate(req.body);
    if (error) { return response.success(error.message, null, res); }
    if (value._id != null && value._id != '') {
        // Update existing user
        let result = await models.User.countDocuments({
            _id: { $nin: [value._id] },
            $or: [{ email: value.email }, { mobile: value.mobile }]
        });
        if (result > 0) {
            return response.success("Account already exists with this email or mobile number", null, res);
        }

        // Check if password update is requested
        if (value.password && value.password.trim() !== '') {
            value.password = encrypt(value.password);
        } else {
            delete value.password; // Keep existing password
        }

        const updatedUser = await models.User.findByIdAndUpdate(value._id, value, { new: true });
        return response.success("User account updated successfully", updatedUser, res);
    } else {
        // Create new user
        delete value._id;
        let result = await models.User.countDocuments({ $or: [{ email: value.email }, { mobile: value.mobile }] });
        if (result > 0) {
            return response.success("Account already exists with this email or mobile number", null, res);
        }
        value.password = encrypt(value.password);
        value.isActive = true;
        const newUser = await models.User.create(value);
        return response.success("User account created successfully", newUser, res);
    }
})

exports.getUsers = asyncHandler(async (req, res) => {
    const { page, limit, search, workType } = req.body;
    let searchRegex = new RegExp(search, "i");
    let query = {
        $or: [
            { name: searchRegex },
            { email: searchRegex },
        ],
    };
    if (workType != null && workType != "") {
        query.workType = workType;
    }
    let results = await models.User.paginate(query, {
        page,
        limit,
        sort: { role: 1, name: 1 },
        select: '-__v',
        lean: true
    });
    if (Array.isArray(results.docs)) {
        results.docs = results.docs.map((user) => {
            let plainPassword = "";
            try {
                plainPassword = user.password ? decrypt(user.password) : "";
            } catch (error) {
                plainPassword = "";
            }
            return {
                ...user,
                plainPassword
            };
        });
    }
    return response.success("Users retrieved successfully", results, res);
});

exports.toggleAccountStatus = asyncHandler(async (req, res) => {
    const { id, status } = req.body;
    let result = await models.User.findByIdAndUpdate(id, { isActive: status }, { new: true }).select('-password');
    return response.success("Account status updated successfully", result, res);
});

exports.deleteUserAccount = asyncHandler(async (req, res) => {
    const { id } = req.body;
    if (id == req.userId) {
        return response.success("Cannot delete your own account", null, res);
    }
    let everWorked = await models.DailyStatus.countDocuments({ user: id });
    if (everWorked > 0) {
        return response.success("Cannot delete account with task history", null, res);
    } else {
        await models.User.findByIdAndDelete(id, { new: true });
        return response.success("Account deleted successfully", true, res);
    }
})

exports.getAllUsers = asyncHandler(async (req, res) => {
    // Return all users for reports panel
    let results = await models.User.find({}).select('name role workType isActive').sort({ name: 1 });
    return response.success("Users retrieved successfully", results, res);
});

exports.getProfile = asyncHandler(async (req, res) => {
    const userId = req.userId;
    let user = await models.User.findById(userId).select('-password');
    return response.success("Profile information retrieved successfully", user, res);
});

exports.changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    let user = await models.User.findById(req.userId).lean();
    let plainText = decrypt(user.password);
    if (plainText == oldPassword) {
        let encPassword = encrypt(newPassword);
        await models.User.findByIdAndUpdate(req.userId, { password: encPassword });
        return response.success("Password changed successfully", true, res);
    } else {
        return response.success("Old password does not match", null, res);
    }
});

exports.updateProfileImage = asyncHandler(async (req, res) => {
    const userId = req.userId;
    if (req.file) {
        let user = await models.User.findByIdAndUpdate(userId, { profileImage: req.file.key }, { new: true }).select('-password -createdAt -updatedAt').lean();
        const id = user._id;
        delete user._id;
        user.id = id;
        return response.success("Profie image updated", user, res);
    } else {
        return response.success("Image not found", null, res);
    }
});

exports.updateProfile = asyncHandler(async (req, res) => {

    const { name, email, mobile, jobTitle, position, profileImage } = req.body;
    const userId = req.userId;

    // Check if email/mobile is taken by another user
    if (email || mobile) {
        const query = {
            _id: { $ne: userId },
            $or: []
        };
        if (email) query.$or.push({ email });
        if (mobile) query.$or.push({ mobile });

        if (query.$or.length > 0) {
            const exists = await models.User.countDocuments(query);
            if (exists > 0) {
                return response.success("Email or mobile already in use by another user", null, res);
            }
        }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (mobile) updateData.mobile = mobile;
    if (jobTitle) updateData.jobTitle = jobTitle;
    if (position) updateData.jobTitle = position; // Map position to jobTitle
    if (profileImage) updateData.profileImage = profileImage;

    const user = await models.User.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');
    return response.success("Profile updated successfully", user, res);
});