const { jiraUrl } = require('./config');
const Client = require('node-rest-client').Client;
const fs = require('fs');
const config = require('./config');

const client = new Client();

// Function to log in to Jira and obtain session cookie
function loginToJira(username, password) {
    return new Promise((resolve, reject) => {
        const loginArgs = {
            data: {
                "username": username,
                "password": password
            },
            headers: {
                "Content-Type": "application/json"
            }
        };

        client.post(`${config.jiraUrl}/rest/auth/1/session`, loginArgs, (data, response) => {
            if (response.statusCode === 200) {
                console.log('Successfully logged in, session:', data.session);
                resolve(data.session);
                const session = data.session;
                const sessionCookie = session.name + '=' + session.value;
                // Save session cookie to file
                saveSessionCookie(sessionCookie);
            } else {
                reject(new Error('Failed to log in'));
            }
        });
    });
}

// Function to save session cookie to file
function saveSessionCookie(sessionCookie) {
    const cookiePath = 'session-cookie.json';
    fs.writeFileSync(cookiePath, JSON.stringify(sessionCookie));
}

// Function to load session cookie from file
function loadSessionCookie() {
    const cookiePath = 'session-cookie.json';
    if (fs.existsSync(cookiePath)) {
        const cookieData = fs.readFileSync(cookiePath, 'utf8');
        return JSON.parse(cookieData);
    }
    return null;
}

function createIssueInJira(issueData, sessionCookie) {

    const createIssueArgs = {
        headers: {
            cookie: sessionCookie,
            "Content-Type": "application/json"
        },
        data: issueData
    };

    console.log(issueData);

    return new Promise((resolve, reject) => {
        client.post(`${jiraUrl}/rest/api/latest/issue`, createIssueArgs, (data, response) => {
            if (response.statusCode === 201) {
                console.log('Issue created:', data.key);
                resolve(data);
            } else {
                console.error('Failed to create issue:', response.statusCode, response.statusMessage);
                console.error('Response body:', data);
                reject(`Failed to create issue: ${response.statusCode} ${response.statusMessage}`);
            }
        });
    });
}



module.exports = {
    loginToJira,
    createIssueInJira,
    saveSessionCookie, 
    loadSessionCookie
};
