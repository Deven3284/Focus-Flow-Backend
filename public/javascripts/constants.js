const BASE_URL = window.location.origin;
const endpoints = {
    LOGIN: `${BASE_URL}/users/signIn`,
    GET_DASHBOARD: `${BASE_URL}/users/getDashboard`,
    UPDATE_TASK_TIMER: `${BASE_URL}/users/updateTaskTimer`,
    CHANGE_PASSWORD: `${BASE_URL}/users/changePassword`,
    GET_PROFILE: `${BASE_URL}/users/getProfile`,
    GET_TODAYS_DATA: `${BASE_URL}/users/getTodaysData`,
    UPDATE_TASKS: `${BASE_URL}/users/updateTasks`,
    START_TIMER: `${BASE_URL}/users/startTimer`,
    STOP_TIMER: `${BASE_URL}/users/stopTimer`,
    TASK_HISTORY: `${BASE_URL}/users/taskHistory`,
    GET_USERS: `${BASE_URL}/users/users`,
    GET_ALL_USERS: `${BASE_URL}/users/getAllUsers`,
    SAVE_USER: `${BASE_URL}/users/saveUser`,
    GENERATE_REPORT: `${BASE_URL}/users/generateReport`,
    ADD_BACKDATED_TASK: `${BASE_URL}/users/addBackdatedTask`,
    GET_PREVIOUS_TASKS: `${BASE_URL}/users/getPreviousPendingTasks`,
    GET_DEVELOPER_REPORT: `${BASE_URL}/users/getDeveloperReport`,
    TOGGLE_ACCOUNT_STATUS: `${BASE_URL}/users/toggleAccountStatus`,
    DELETE_USER_ACCOUNT: `${BASE_URL}/users/deleteUserAccount`,
    UPLOAD_PROFILE_IMAGE: `${BASE_URL}/users/updateProfileImage`,
    GET_FACE_COMPARISON: `${BASE_URL}/users/getFaceComparison`,
}

const headerConfig = {
    headers: {
        'Authorization': `Bearer`,
        'Accept': 'application/json'
    }
}