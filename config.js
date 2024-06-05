const config = {
    DEBUG_MODE: false, // Set to true to enable debug mode
    JIRA_USER: process.env.JIRA_USER,
    JIRA_PASSWD: process.env.JIRA_PASSWD,
    JIRA_PORT: "",
    JIRA_SERVER: "jira.gameloft.org",
    JIRA_PROTOCOL: 'https',
    PROJECT_ID: process.env.PROJECT_ID,
}

config.JIRA_URL = `${config.JIRA_PROTOCOL}://${config.JIRA_SERVER}${ config.JIRA_PORT ? ":" + config.JIRA_PORT : ''}`;

config.debug = function(message) {
    if (config.DEBUG_MODE) {
        console.log(message);
    }
}

module.exports = config;
