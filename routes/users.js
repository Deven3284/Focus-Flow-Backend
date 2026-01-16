const express = require('express');
const router = express.Router();

const timerCtrl = require('./../controllers/web/timer');
const authCtrl = require('./../controllers/web/authentication');
const projectCtrl = require('./../controllers/web/project');
const ticketCtrl = require('./../controllers/web/tickets');
const usersCtrl = require('./../controllers/web/users');
const { authMiddleware, adminCheck } = require('./../middleware/auth_middleware');
const uploader = require('./../utils/aws_upload').uploadToAWS;
const { memory } = require('../utils/aws_upload');

router.post("/signIn", authCtrl.signIn);
router.post("/getDashboard", authMiddleware, authCtrl.getDashboard);
router.post("/getDeveloperReport", authMiddleware, authCtrl.getDeveloperReport);
router.post("/saveUser", authMiddleware, adminCheck, authCtrl.saveUser);
router.post("/users", authMiddleware, adminCheck, authCtrl.getUsers);
router.post("/getAllUsers", authMiddleware, adminCheck, authCtrl.getAllUsers);
router.post("/changePassword", authMiddleware, authCtrl.changePassword);
router.post("/toggleAccountStatus", authMiddleware, adminCheck, authCtrl.toggleAccountStatus);
router.post("/deleteUserAccount", authMiddleware, adminCheck, authCtrl.deleteUserAccount);


router.post("/getProfile", authMiddleware, authCtrl.getProfile);
router.post("/updateProfile", authMiddleware, authCtrl.updateProfile);
router.post("/updateProfileImage", authMiddleware, uploader("profileImages").single('file'), authCtrl.updateProfileImage);
router.post("/getAssignedTasks", authMiddleware, timerCtrl.getAssignedTasks);
router.post("/getPreviousPendingTasks", authMiddleware, timerCtrl.getPreviousPendingTasks);

router.post("/getTodaysData", authMiddleware, timerCtrl.getTodaysData);
router.post("/updateTasks", authMiddleware, timerCtrl.updateTasks);
router.post("/updateTaskTimer", authMiddleware, timerCtrl.updateTaskTimer);
router.post("/startTimer", authMiddleware, timerCtrl.startTimer);
router.post("/stopTimer", authMiddleware, timerCtrl.stopTimer);
router.post("/deleteTask", authMiddleware, timerCtrl.deleteTask);
router.post("/addBackdatedTask", authMiddleware, timerCtrl.addBackdatedTask);

router.post("/taskHistory", authMiddleware, timerCtrl.getHistory);
router.post("/generateReport", authMiddleware, adminCheck, timerCtrl.generateReport);
router.post("/getEmployeesAttendanceData", timerCtrl.getReportData);

router.post("/getProjects", authMiddleware, adminCheck, projectCtrl.getProjects);
router.post("/saveProjects", authMiddleware, adminCheck, projectCtrl.saveProjects);
router.post("/deleteProjects", authMiddleware, adminCheck, projectCtrl.deleteProject);

router.post("/getTickets", authMiddleware, ticketCtrl.getTickets);
router.post("/saveTickets", authMiddleware, ticketCtrl.saveTickets);
router.post("/updateTickets", authMiddleware, ticketCtrl.updateTickets);
router.post("/deleteTicket", authMiddleware, adminCheck, ticketCtrl.deleteTicket);

router.post("/compare-faces", authMiddleware, memory.single('file'), usersCtrl.compareFaces);
router.post("/getFaceComparison", authMiddleware, usersCtrl.getFaceComparison);

// SOP Document Routes
const sopCtrl = require('./../controllers/web/sop');
router.post("/createSOP", authMiddleware, adminCheck, sopCtrl.createSOP);
router.post("/getSOPs", authMiddleware, sopCtrl.getSOPs);
router.post("/getSOPById", authMiddleware, sopCtrl.getSOPById);
router.post("/updateSOP", authMiddleware, adminCheck, sopCtrl.updateSOP);
router.post("/deleteSOP", authMiddleware, adminCheck, sopCtrl.deleteSOP);
router.post("/acknowledgeSOP", authMiddleware, sopCtrl.acknowledgeSOP);
router.post("/getUnreadSOPCount", authMiddleware, sopCtrl.getUnreadSOPCount);

module.exports = router;
