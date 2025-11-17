const Client = require('node-rest-client').Client;
const fs = require('fs');
const config = require('./config');
const { Console } = require('console');

const client = new Client();


// Function to create the Authorization header
function getAuthHeaders(optionalPAT = null) {
    const pat = optionalPAT || global.pat; // Use the provided PAT or fallback to the global PAT
    if (!pat) {
        throw new Error('PAT is not configured. Provide a PAT or call setJiraPAT first.');
    }

    return {
        "Authorization": `Bearer ${pat}`, // Use the specified or global PAT
        "Content-Type": "application/json"
    };
}

// Function to validate the session with optional PAT
function validateJiraSession(optionalPAT = null) {
    return new Promise((resolve) => {
        const args = {
            headers: getAuthHeaders(optionalPAT) // Use optional PAT or global PAT
        };

        client.get(`${config.JIRA_URL}/rest/api/latest/myself`, args, (data, response) => {
            if (response.statusCode === 200) {
                resolve(true);  // Session is valid
            } else {
                resolve(false); // Session is invalid
            }
        });
    });
}

// Function to get Jira user information
function getJiraUserInfo() {
    return new Promise((resolve, reject) => {
        const args = {
            headers: getAuthHeaders()
        };

        client.get(`${config.JIRA_URL}/rest/api/latest/myself`, args, (data, response) => {
            if (response.statusCode === 200) {
                resolve(data);  // Return user information
            } else {
                reject(new Error('Failed to retrieve user information. Session cookie might be invalid.' + response));
            }
        });
    });
}

// Function to configure the Authorization header with a PAT
function setJiraPAT(pat) {
    if (!pat) {
        throw new Error('PAT is required to authenticate with Jira.');
    }
    // Store the PAT for use in subsequent API requests
    global.pat = pat;
}

// Function to save session cookie to file
function savePAT(pat) {
    const patPath = 'session-pat.json';
    fs.writeFileSync(patPath, JSON.stringify(pat));
}

// Function to load session cookie from file
function loadPAT() {
    const patPath = 'session-pat.json';
    if (fs.existsSync(patPath)) {
        const patData = fs.readFileSync(patPath, 'utf8');
        return JSON.parse(patData);
    }
    return null;
}

async function createIssueInJira(issueData) {
    try {
        // Validate session cookie
        const isSessionValid = await validateJiraSession();
        if (!isSessionValid) {
            throw new Error('Session is invalid. Please reauthenticate.');
        }

        const createIssueArgs = {
            headers: getAuthHeaders(),
            data: issueData
        };

        // Create the issue in Jira
        return new Promise((resolve, reject) => {
            client.post(`${config.JIRA_URL}/rest/api/latest/issue`, createIssueArgs, (data, response) => {
                if (response.statusCode === 201) {
                    config.debug('Issue created:', data.key);
                    resolve(data);
                } else {
                    const responseBody = Buffer.isBuffer(data) ? data.toString('utf8') : data;

                    console.error('Error! Failed to create issue:', response.statusCode, response.statusMessage);
                    console.error('Response body:', responseBody);
                    console.error('Request Payload:', createIssueArgs);
                    console.error('Response Headers:', response.headers);

                    let parsedBody = null;
                    try {
                        parsedBody = JSON.parse(responseBody);
                    } catch (err) {
                        console.error('Failed to parse response body as JSON');
                    }

                    reject(
                        `Failed to create issue: ${response.statusCode} ${response.statusMessage}. JSON Body: ${JSON.stringify(parsedBody || issueData)}`
                    );
                }
            });
        });
    } catch (error) {
        // Handle session validation or other errors
        console.error(error.message);
        throw new Error(`Error in createIssueInJira: ${error.message}`);
    }
}



// Function to create a link between two issues
function linkIssuesInJira(issueKey1, issueKey2, linkType) {
    return new Promise((resolve, reject) => {
        const linkArgs = {
            headers: getAuthHeaders(),
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

        client.post(`${config.JIRA_URL}/rest/api/latest/issueLink`, linkArgs, (data, response) => {
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
function getIssueDetails(issueKey) {
    return new Promise((resolve, reject) => {
        client.get(`${config.JIRA_URL}/rest/api/2/issue/${issueKey}`, {
            headers: getAuthHeaders(),
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
async function retrieveChildren(issueKey) {
    const issueDetails = await getIssueDetails(issueKey);
    const linkedIssues = [];

    // Function to recursively retrieve linked issues
    async function retrieveLinkedIssues(issueKey, parentIssueType, parentSummary) {
        const issueDetails = await getIssueDetails(issueKey);
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
                await retrieveLinkedIssues(linkedIssueKey, issueType, summary);
            }
        }
    }

    // Start recursion with the main issue
    await retrieveLinkedIssues(issueKey, issueDetails.fields.issuetype.name, issueDetails.fields.summary);

    return linkedIssues;
}

module.exports = {
    validateJiraSession,
    getJiraUserInfo,
    createIssueInJira,
    setJiraPAT,
    savePAT, 
    loadStoredPAT: loadPAT,
    getIssueDetails,
    retrieveChildren
};
