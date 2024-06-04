const config = {
    ticketPattern: /(([A-Z]{2,})-\d{1,})/g,
    JIRA_USER: process.env.JIRA_USER,
    JIRA_PASSWD: process.env.JIRA_PASSWD,
    JIRA_PORT: "",
    JIRA_SERVER: "jira.gameloft.org",
    JIRA_PROTOCOL: 'https',
    PROJECT_ID: process.env.PROJECT_ID,
}

config.JIRA_URL = `${config.JIRA_PROTOCOL}://${config.JIRA_SERVER}${ config.JIRA_PORT ? ":" + config.JIRA_PORT : ''}`;

module.exports = config;
