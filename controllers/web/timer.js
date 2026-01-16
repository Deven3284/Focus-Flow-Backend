const xlsx = require('xlsx');
const moment = require('moment-timezone');
const mongoose = require('mongoose');
const models = require('./../../models/zindex');
const response = require('./../../utils/response');
const asyncHandler = require("express-async-handler");
const { DateTime } = require('luxon');

exports.getAssignedTasks = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const getAssignedTasks = await models.Tasks.find({ assignedTo: userId, isAdded: false });
    return response.success("Tasks retrieved successfully", getAssignedTasks, res);
});

exports.getTodaysData = asyncHandler(async (req, res) => {
    const userId = req.userId;
    let data = await models.DailyStatus.find({
        user: userId,
        $or: [
            { endTime: null },
            { date: moment.utc().tz('Asia/Kolkata').startOf('day').toDate() },
        ]
    });
    return response.success("Day data fetched", data, res);
});

exports.getPreviousPendingTasks = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const today = moment().startOf('day').toDate();
    const previousDays = await models.DailyStatus.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(userId),
                date: { $lt: today },
                'tasks.status': { $in: ['not-started', 'in-progress'] },
                'tasks.carriedOver': false
            }
        },
        {
            $unwind: '$tasks'
        },
        {
            $match: {
                'tasks.status': { $in: ['not-started', 'in-progress'] }
            }
        },
        {
            $group: {
                _id: null,
                tasks: { $push: '$tasks' }
            }
        }
    ]);
    let tasks = previousDays[0]?.tasks || [];

    tasks = tasks.map((v) => {
        const id = v._id;
        v._id = new mongoose.Types.ObjectId();
        v.isThisTaskCarried = true;
        v.previousTaskId = id;
        return v;
    });

    return response.success("Previous tasks fetched", tasks, res);
});

exports.updateTasks = asyncHandler(async (req, res) => {
    let { id, tasks } = req.body;
    let dailyStatus = await models.DailyStatus.findById(id);
    if (dailyStatus != null) {
        if (dailyStatus.startTime != null && dailyStatus.endTime != null) {
            return response.success("Cannot update tasks! your day is ended.", null, res);
        } else {
            tasks = tasks.map((v) => {
                if (v._id == null) { v._id = new mongoose.Types.ObjectId(); }
                return v;
            });
            await models.DailyStatus.findByIdAndUpdate(id, { $set: { tasks: tasks } }, { new: true });
            return response.success("Tasks updated successfully!", true, res);
        }

    } else {
        return response.success("Unable to update tasks!", null, res);
    }
});

exports.updateTaskTimer = asyncHandler(async (req, res) => {
    let { id, task } = req.body;
    let dailyStatus = await models.DailyStatus.findById(id);
    if (dailyStatus != null) {
        if (dailyStatus.startTime != null && dailyStatus.endTime != null) {
            return response.success("Cannot update tasks! your day is ended.", null, res);
        } else {
            let tasks = dailyStatus.tasks;
            tasks = tasks.map((e) => { if (String(e._id) == String(task._id)) { e = task; } return e; });
            let result = await models.DailyStatus.findByIdAndUpdate(id, { $set: { tasks: tasks } }, { new: true });
            let updatedTask = result.tasks.filter((e) => String(e._id) == String(task._id))[0];
            return response.success("Task updated successfully!", updatedTask, res);
        }
    } else {
        return response.success("Unable to update tasks!", null, res);
    }
});

exports.startTimer = asyncHandler(async (req, res) => {
    let { user, tasks } = req.body;
    const todayDateTime = moment().startOf('day').toDate();
    const currentDateTime = moment().toDate();

    let countIfAlreadyStarted = await models.DailyStatus.countDocuments({
        user: user,
        date: todayDateTime
    });
    if (countIfAlreadyStarted > 0) {
        return response.success("Timer is already started", null, res);
    } else {
        tasks = tasks.map((e) => {
            e._id = new mongoose.Types.ObjectId();
            return e;
        });
        const newStatus = await models.DailyStatus.create({
            user: user,
            date: todayDateTime,
            startTime: currentDateTime,
            tasks: tasks,
        });
        return response.success("Timer started", newStatus, res);
    }
});

exports.stopTimer = asyncHandler(async (req, res) => {
    const { id } = req.body;
    let result = await models.DailyStatus.findById(id).lean();
    let currentDate = moment().toDate();
    result.tasks = result.tasks.map((v) => {
        v.isTrackerStarted = false;
        v.endedTime = currentDate
        return v;
    })
    await models.DailyStatus.findByIdAndUpdate(id, { endTime: moment().toDate(), tasks: result.tasks }, { new: true });
    return response.success("Timer stopped successfully", true, res);
});

exports.deleteTask = asyncHandler(async (req, res) => {
    const { id, taskId } = req.body;
    await models.DailyStatus.findByIdAndUpdate(id, {
        $pull: { tasks: { _id: taskId } }
    }, { new: true });
    return response.success("Task deleted successfully", true, res);
});

exports.getHistory = asyncHandler(async (req, res) => {
    const { selectedMonth, selectedUserId } = req.body;
    let userId = selectedUserId || req.userId;
    const givenDate = moment.utc(selectedMonth).tz('Asia/Kolkata');
    const firstDate = givenDate.clone().startOf('month').toDate();
    const lastDate = givenDate.clone().endOf('month').toDate();
    let histories = await models.DailyStatus.find({
        user: userId,
        $and: [
            { date: { $gte: firstDate } },
            { date: { $lte: lastDate } },
        ]
    }).sort({ _id: -1 }).lean();

    histories = histories.map((v) => {
        const timezone = 'Asia/Kolkata';
        const dateSource = v.startTime || v.date;
        const rawDateMoment = dateSource ? moment.utc(dateSource).tz(timezone) : null;
        v.rawDate = rawDateMoment ? rawDateMoment.format('YYYY-MM-DD') : '';
        v.startTimeValue = v.startTime ? moment.utc(v.startTime).tz(timezone).format('HH:mm') : '';
        v.endTimeValue = v.endTime ? moment.utc(v.endTime).tz(timezone).format('HH:mm') : '';
        v.date = rawDateMoment ? rawDateMoment.format('MMM D, YYYY') : '-';
        v.startTime = v.startTime ? moment.utc(v.startTime).tz(timezone).format('MMM D, YYYY h:mm A') : '-';
        v.endTime = v.endTime == null || v.endTime == '' ? '-' : moment.utc(v.endTime).tz(timezone).format('MMM D, YYYY h:mm A');
        return v;
    });
    return response.success("Fetched history", histories, res);
});

exports.addBackdatedTask = asyncHandler(async (req, res) => {
    const { date, startTime, endTime, tasks = [], userId } = req.body;
    let targetUserId = req.userId;

    if (!date || !Array.isArray(tasks)) {
        return response.success("Date and tasks are required", null, res);
    }

    if (req.userRole === 'admin' && userId) {
        targetUserId = userId;
    } else if (userId && String(userId) !== String(req.userId)) {
        return response.success("You are not allowed to add tasks for another user", null, res);
    }

    const timezone = 'Asia/Kolkata';
    let parsedDate = moment.tz(date, 'YYYY-MM-DD', true, timezone);
    if (!parsedDate.isValid()) {
        return response.success("Invalid date format", null, res);
    }

    let startDateTime = startTime ? moment.tz(`${date} ${startTime}`, 'YYYY-MM-DD HH:mm', true, timezone) : null;
    let endDateTime = endTime ? moment.tz(`${date} ${endTime}`, 'YYYY-MM-DD HH:mm', true, timezone) : null;

    // Validate date/time formats
    if (startTime && (!startDateTime || !startDateTime.isValid())) {
        return response.success("Invalid start time format", null, res);
    }
    if (endTime && (!endDateTime || !endDateTime.isValid())) {
        return response.success("Invalid end time format", null, res);
    }

    const sanitizedTasks = tasks
        .map((task) => typeof task === 'string' ? task.trim() : '')
        .filter((task) => task.length > 0);

    if (sanitizedTasks.length === 0) {
        return response.success("Please provide at least one valid task", null, res);
    }

    // Convert to UTC for MongoDB date comparison (matching pattern from getTodaysData)
    // Use UTC conversion to ensure proper date matching in MongoDB
    const startOfDay = parsedDate.clone().startOf('day').toDate();
    const endOfDay = parsedDate.clone().endOf('day').toDate();

    let dailyStatus = await models.DailyStatus.findOne({
        user: targetUserId,
        date: { $gte: startOfDay, $lte: endOfDay }
    });

    const tasksToInsert = sanitizedTasks.map((taskDescription) => ({
        _id: new mongoose.Types.ObjectId(),
        task: taskDescription,
        assignedTo: targetUserId,
        assignedBy: req.userId,
        status: 'not-started',
        priority: 'medium',
        isTrackerStarted: false,
        initalStartedTime: null,
        lastStartedTime: null,
        endedTime: null,
        countView: "00:00:00",
        totalSeconds: 0,
        estimatedTime: { hour: "0", minutes: "15" },
        carriedOver: false
    }));

    if (!dailyStatus) {
        if (!startDateTime || !endDateTime || !endDateTime.isAfter(startDateTime)) {
            return response.success("Valid start and end times are required for new days", null, res);
        }
        dailyStatus = await models.DailyStatus.create({
            user: targetUserId,
            date: startOfDay,
            startTime: startDateTime.toDate(),
            endTime: endDateTime.toDate(),
            tasks: tasksToInsert
        });
    } else {
        // Update startTime if not set or if new startTime is provided and earlier
        if (startDateTime) {
            if (!dailyStatus.startTime || moment.tz(dailyStatus.startTime, timezone).isAfter(startDateTime)) {
                dailyStatus.startTime = startDateTime.toDate();
            }
        }
        // Update endTime if not set or if new endTime is provided and later
        if (endDateTime) {
            // Get the final startTime value (after potential update above)
            const finalStartTime = dailyStatus.startTime;
            if (finalStartTime && !endDateTime.isAfter(moment.tz(finalStartTime, timezone))) {
                return response.success("End time must be after start time", null, res);
            }
            if (!dailyStatus.endTime ||
                (finalStartTime && moment.tz(dailyStatus.endTime, timezone).isBefore(endDateTime))) {
                dailyStatus.endTime = endDateTime.toDate();
            }
        }
        // Final validation: ensure endTime is after startTime if both exist
        if (dailyStatus.startTime && dailyStatus.endTime) {
            if (!moment.tz(dailyStatus.endTime, timezone).isAfter(moment.tz(dailyStatus.startTime, timezone))) {
                return response.success("End time must be after start time", null, res);
            }
        }
        // Ensure date is set
        if (!dailyStatus.date) {
            dailyStatus.date = startOfDay;
        }
        dailyStatus.tasks = dailyStatus.tasks.concat(tasksToInsert);
        await dailyStatus.save();
    }

    return response.success("Backdated tasks added successfully", dailyStatus, res);
});

exports.generateReport = async (req, res) => {
    try {
        const { selectedMonth, selectedYear, workType } = req.body;
        console.log('GenerateReport Payload:', { selectedMonth, selectedYear, workType });

        if (!selectedMonth || !selectedYear) {
            console.error('Missing selectedMonth or selectedYear');
            return response.success("Month and Year are required", null, res);
        }

        const timezone = 'Asia/Kolkata';
        const reportYear = Number(selectedYear);
        const reportMonth = Number(selectedMonth); // Expecting 1-12

        // Create date strictly
        const givenDate = moment.tz(`${reportYear}-${reportMonth}-01`, 'YYYY-M-DD', timezone);

        if (!givenDate.isValid()) {
            console.error('Invalid Date constructed:', `${reportYear}-${reportMonth}-01`);
            return response.success("Invalid Month or Year provided", null, res);
        }

        const firstDate = givenDate.clone().startOf('month').toDate();
        const lastDate = givenDate.clone().endOf('month').toDate();

        console.log('Query Date Range:', { firstDate, lastDate });

        const workbook = xlsx.utils.book_new();

        console.log('Generating report for:', { selectedMonth, selectedYear, workType });

        // Generate date range for the selected month using moment
        const year = givenDate.year();
        const month = givenDate.month() + 1;
        const daysInMonth = givenDate.daysInMonth();

        // Create date range using moment
        const dateRange = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = givenDate.clone().date(day);
            dateRange.push(currentDate.format('YYYY-MM-DD'));
        }

        // GET USERS TO CREATE SHEET
        let query = { isActive: true, role: { $nin: "admin" } };
        if (workType && workType !== 'all') {
            query.workType = workType;
        }

        console.log('User query:', query);
        let users = await models.User.find(query).lean();
        console.log(`Found ${users.length} users for report`);

        for (let i = 0; i < users.length; i++) {
            let results = await models.DailyStatus.find({
                user: users[i]._id,
                $and: [
                    { date: { $gte: firstDate } },
                    { date: { $lte: lastDate } },
                ]
            }).lean();

            // Parse dates using moment
            const records = results.map(entry => ({
                date: entry.date ? moment.utc(entry.date).tz(timezone).format('YYYY-MM-DD') : null,
                startTime: entry.startTime ? moment.utc(entry.startTime).tz(timezone) : null,
                endTime: entry.endTime ? moment.utc(entry.endTime).tz(timezone) : null,
                tasks: Array.isArray(entry.tasks)
                    ? entry.tasks
                        .map(task => task?.task)
                        .filter(Boolean)
                    : []
            })).filter(record => record.date);

            // Prepare data for Excel
            let totalWorkingDays = 0;
            let actualWorkingDays = 0;

            const excelData = dateRange.map((date, index) => {
                const record = records.find(r => String(r.date) === String(date));
                const hasStartTime = record ? record.startTime ? true : false : false;
                const hasEndTime = record ? record.endTime ? true : false : false;
                let tasksSummary = '';
                if (record && record.tasks && record.tasks.length) {
                    tasksSummary = record.tasks.join('\n');
                }

                // Get day name from date using moment
                const dateObj = moment.tz(date, 'YYYY-MM-DD', timezone);
                const dayName = dateObj.format('dddd');
                const isWeekend = ['Saturday', 'Sunday'].includes(dayName);

                // Count working days (excluding weekends)
                if (!isWeekend) {
                    totalWorkingDays++;
                    if (hasStartTime && hasEndTime) {
                        actualWorkingDays++;
                    }
                }

                return {
                    'SRNO': index + 1,
                    'DATE': date,
                    'DAY': dayName,
                    'WORK STATUS': hasStartTime && hasEndTime ? 'Worked' : 'Not Worked',
                    'START TIME': hasStartTime ? record.startTime.format('MMM D, YYYY h:mm A') : '',
                    'END TIME': hasEndTime ? record.endTime.format('MMM D, YYYY h:mm A') : '',
                    'TASKS': tasksSummary || '-',
                    'REMARK': hasStartTime && !hasEndTime ? 'EOD Missing' : '',
                };
            });

            // Add summary rows
            excelData.push(
                {}, // Empty row for separation
                {
                    'SRNO': '',
                    'DATE': 'SUMMARY',
                    'DAY': '',
                    'WORK STATUS': '',
                    'START TIME': '',
                    'END TIME': '',
                    'TASKS': '',
                    'REMARK': ''
                },
                {
                    'SRNO': '',
                    'DATE': 'Total Working Days (excl. weekends)',
                    'DAY': totalWorkingDays,
                    'WORK STATUS': '',
                    'START TIME': '',
                    'END TIME': '',
                    'TASKS': '',
                    'REMARK': ''
                },
                {
                    'SRNO': '',
                    'DATE': 'Actual Working Days',
                    'DAY': actualWorkingDays,
                    'WORK STATUS': '',
                    'START TIME': '',
                    'END TIME': '',
                    'TASKS': '',
                    'REMARK': ''
                },
                {
                    'SRNO': '',
                    'DATE': 'Attendance Percentage',
                    'DAY': totalWorkingDays > 0 ? `${Math.round((actualWorkingDays / totalWorkingDays) * 100)}%` : '0%',
                    'WORK STATUS': '',
                    'START TIME': '',
                    'END TIME': '',
                    'TASKS': '',
                    'REMARK': ''
                }
            );

            const worksheet = xlsx.utils.json_to_sheet(excelData, {
                header: ['SRNO', 'DATE', 'DAY', 'WORK STATUS', 'START TIME', 'END TIME', 'TASKS', 'REMARK'],
                skipHeader: false
            });

            // Force wrap text for TASKS column so every task appears on its own line
            if (worksheet['!ref']) {
                const range = xlsx.utils.decode_range(worksheet['!ref']);
                for (let row = range.s.r + 1; row <= range.e.r; row++) {
                    const cellAddress = xlsx.utils.encode_cell({ r: row, c: 4 }); // column E (TASKS)
                    const cell = worksheet[cellAddress];
                    if (cell && cell.v) {
                        cell.s = cell.s || {};
                        cell.s.alignment = Object.assign({}, cell.s.alignment, { wrapText: true });
                    }
                }
            }

            // Add column styling and width
            // SRNO width 5
            const cols = [
                { wch: 5, s: { alignment: { horizontal: 'center', vertical: 'center' } } },   // SRNO
                { wch: 18, s: { alignment: { horizontal: 'center', vertical: 'center' } } },  // DATE
                { wch: 18, s: { alignment: { horizontal: 'center', vertical: 'center' } } },  // DAY
                { wch: 18, s: { alignment: { horizontal: 'center', vertical: 'center' } } },  // WORK STATUS
                { wch: 18, s: { alignment: { horizontal: 'center', vertical: 'center' } } },  // START TIME
                { wch: 18, s: { alignment: { horizontal: 'center', vertical: 'center' } } },  // END TIME
                { wch: 80, s: { alignment: { horizontal: 'center', vertical: 'center' } } },  // TASKS
                { wch: 18, s: { alignment: { horizontal: 'center', vertical: 'center' } } }   // REMARK
            ];
            worksheet['!cols'] = cols;

            // Sanitize sheet name (remove invalid chars for Excel: : \ / ? * [ ])
            let sheetName = users[i].name ? users[i].name.replace(/[:\\/?*\[\]]/g, "") : "User " + (i + 1);
            sheetName = sheetName.substring(0, 30) || "User " + (i + 1);

            xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
        }

        // Check if workbook has sheets, if not add a dummy one (Excel requires at least 1 sheet)
        if (workbook.SheetNames.length === 0) {
            const dummyWs = xlsx.utils.json_to_sheet([{ Message: "No users or data found for the selected criteria." }]);
            xlsx.utils.book_append_sheet(workbook, dummyWs, "No Data");
        }

        const fileName = `itf_work_status_${month}_${year}.xlsx`;

        // Write to buffer and send response
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set headers properly
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.send(buffer);

    } catch (error) {
        console.error('Error generating Excel file:', error);
        res.status(500).json({
            error: 'Error generating Excel file',
            message: error.message
        });
    }
}

exports.getReportData = asyncHandler(async (req, res) => {
    try {
        const { selectedMonth, workType } = req.body;

        // Parse the selectedMonth with proper format
        const givenDate = moment(selectedMonth, 'YYYY-MM-DD');
        const firstDate = givenDate.clone().startOf('month').toDate();
        const lastDate = givenDate.clone().endOf('month').toDate();

        // Generate date range for the selected month
        const year = givenDate.year();
        const month = givenDate.month() + 1;
        const startDate = DateTime.fromObject({ year, month, day: 1 });
        const endDate = startDate.endOf('month');
        const daysInMonth = endDate.day;
        const dateRange = Array.from({ length: daysInMonth }, (_, i) => startDate.plus({ days: i }).toISODate());

        // GET USERS TO CREATE DATA
        let users = await models.User.find({ isActive: true, role: { $nin: "admin" }, workType: workType || "remote" });

        const reportData = [];

        for (let i = 0; i < users.length; i++) {
            let results = await models.DailyStatus.find({
                user: users[i]._id,
                $and: [
                    { date: { $gte: firstDate } },
                    { date: { $lte: lastDate } },
                ]
            }).lean();

            // Parse dates and create a map for quick lookup
            const recordsMap = {};
            results.forEach(entry => {
                if (entry.date) {
                    const dateKey = DateTime.fromJSDate(new Date(entry.date)).toISODate();
                    recordsMap[dateKey] = {
                        startTime: entry.startTime,
                        endTime: entry.endTime
                    };
                }
            });

            // Calculate working days
            let totalWorkingDays = 0;
            let actualWorkingDays = 0;

            dateRange.forEach((date) => {
                const dateObj = DateTime.fromISO(date);
                const dayName = dateObj.toFormat('EEEE');
                const isWeekend = ['Saturday', 'Sunday'].includes(dayName);

                // Count working days (excluding weekends)
                if (!isWeekend) {
                    totalWorkingDays++;

                    // Check if user worked on this day
                    const record = recordsMap[date];
                    if (record && record.startTime && record.endTime) {
                        actualWorkingDays++;
                    }
                }
            });

            // Add summary data
            const summary = {
                totalWorkingDays: totalWorkingDays,
                actualWorkingDays: actualWorkingDays,
                attendancePercentage: totalWorkingDays > 0 ? Math.round((actualWorkingDays / totalWorkingDays) * 100) : 0
            };

            reportData.push({
                user: {
                    id: users[i]._id,
                    name: users[i].name,
                    email: users[i].email,
                    mobile: users[i].mobile,
                    jobTitle: users[i].jobTitle,
                    workType: users[i].workType
                },
                summary: summary
            });
        }

        return response.success("Report data fetched successfully", reportData, res);
    } catch (error) {
        console.error('Error fetching report data:', error);
        return response.error("Error fetching report data", error.message, res);
    }
});