const Client = require('node-rest-client').Client;
const fs = require('fs');
const config = require('./config');

const client = new Client();

let sessionCookie = LoadSession(); // Load session cookie once when module is loaded

// Function to log in to Jira and obtain session cookie
function LoginJira(username, password) {
    return new Promise((resolve, reject) => {
        const args = {
            headers: {
                "Content-Type": "application/json"
            },
            data: {
                "username": username,
                "password": password
            }
        };

        client.post(`${config.JIRA_URL}/rest/auth/1/session`, args, (data, response) => {
            if (response.statusCode === 200) {
                const session = data.session;
                sessionCookie = session.name + '=' + session.value; // Update sessionCookie variable
                SaveSession(sessionCookie);
                resolve(sessionCookie);
            } else {
                reject(new Error('Invalid username or password.'));
            }
        });
    });
}

// Function to validate the session cookie
function ValidateJiraSession() {
    return new Promise((resolve) => {
        const args = {
            headers: {
                cookie: sessionCookie // Use sessionCookie directly
            }
        };

        client.get(`${config.JIRA_URL}/rest/api/latest/myself`, args, (data, response) => {
            if (response.statusCode === 200) {
                resolve(true);  // Session cookie is valid
            } else {
                resolve(false); // Session cookie is invalid
            }
        });
    });
}

// Function to get Jira user information
function GetJiraUser() {
    return new Promise((resolve, reject) => {
        const args = {
            headers: {
                cookie: sessionCookie // Use sessionCookie directly
            }
        };

        client.get(`${config.JIRA_URL}/rest/api/latest/myself`, args, (data, response) => {
            if (response.statusCode === 200) {
                resolve(data);  // Return user information
            } else {
                reject(new Error('Failed to retrieve user information. Session cookie might be invalid.'));
            }
        });
    });
}

// Function to save session cookie to file
function SaveSession(sessionCookie) {
    const cookiePath = 'session-cookie.json';
    fs.writeFileSync(cookiePath, JSON.stringify(sessionCookie));
}

// Function to load session cookie from file
function LoadSession() {
    const cookiePath = 'session-cookie.json';
    if (fs.existsSync(cookiePath)) {
        const cookieData = fs.readFileSync(cookiePath, 'utf8');
        return JSON.parse(cookieData);
    }
    return null;
}

function CreateIssueInJira(issueData) {
    const args = {
        headers: {
            cookie: sessionCookie,
            "Content-Type": "application/json"
        },
        data: issueData
    };

    config.debug(issueData);

    return new Promise((resolve, reject) => {
        client.post(`${config.JIRA_URL}/rest/api/latest/issue`, args, (data, response) => {
            if (response.statusCode === 201) {
                config.debug('Issue created:', data.key);
                resolve(data);
            } else {
                reject({ message: 'Failed to create issue', errors: data.errors });
            }
        });
    });

}


// Function to create a link between two issues
function LinkIssuesInJira(issueKey1, issueKey2, linkType) {
    return new Promise((resolve, reject) => {
        const args = {
            headers: {
                cookie: sessionCookie,
                "Content-Type": "application/json"
            },
            data: {
                type: {
                    name: linkType // Link type, e.g., "Blocks", "Relates To", etc.
                },
                inwardIssue: {
                    key: issueKey1 // Issue key of the inward issue
                },
                outwardIssue: {
                    key: issueKey2 // Issue key of the outward issue
                }
            }
        };

        client.post(`${config.JIRA_URL}/rest/api/latest/issueLink`, args, (data, response) => {
            if (response.statusCode === 201) {
                console.log('Issues linked successfully');
                resolve(data);
            } else {
                console.error('Failed to link issues:', response.statusCode, response.statusMessage);
                console.error('Response body:', data);
                reject(`Failed to link issues: ${response.statusCode} ${response.statusMessage}`);
            }
        });
    });
}

/**
 * async function linkRelatedIssues(issueKey1, issueKey2, linkType) {
    try {
        await linkIssues(issueKey1, issueKey2, linkType);
        console.log('Issues linked successfully');
    } catch (error) {
        console.error('Error linking issues:', error.message);
    }
}
 */

// Function to retrieve issue details
function GetIssue(issueKey) {
    return new Promise((resolve, reject) => {
        client.get(`${config.JIRA_URL}/rest/api/2/issue/${issueKey}`, {
            headers: {
                cookie: sessionCookie
            }
        }, (data, response) => {
            if (response.statusCode === 200) {
                resolve(data);
            } else {
                reject(`Failed to retrieve issue details: ${response.statusCode} ${response.statusMessage}`);
            }
        });
    });
}

// Function to retrieve issue links
async function GetIssueLinks(issueKey) {
    const issueDetails = await GetIssue(issueKey);
    const linkedIssues = [];

    // Function to recursively retrieve linked issues
    async function GetLinkedIssues(issueKey, parentIssueType, parentSummary) {
        const issueDetails = await GetIssue(issueKey);
        const issueType = issueDetails.fields.issuetype.name;
        const summary = issueDetails.fields.summary;
        
        linkedIssues.push({
            issueType: parentIssueType,
            issueKey,
            summary
        });

        // Retrieve and process linked issues recursively
        if (issueDetails.fields.issuelinks) {
            for (const link of issueDetails.fields.issuelinks) {
                let linkedIssueKey = link.outwardIssue ? link.outwardIssue.key : link.inwardIssue.key;
                await GetLinkedIssues(linkedIssueKey, issueType, summary);
            }
        }
    }

    // Start recursion with the main issue
    await GetLinkedIssues(issueKey, issueDetails.fields.issuetype.name, issueDetails.fields.summary);

    return linkedIssues;
}



module.exports = {
    LoginJira,
    ValidateJiraSession,
    GetJiraUser,
    CreateIssueInJira,
    SaveSession, 
    LoadSession,
    GetIssue
};
