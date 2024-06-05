// Core modules
const readline = require('readline');

// Custom modules
const { loginToJira, validateJiraSession, loadSessionCookie, getJiraUserInfo, retrieveChildren, getIssueDetails } = require('./jiraApi');
const { displayFileList, captureLogin, promptForUniqueValues } = require('./uiPrompts');
const { processIssues, extractUniquePlaceholders } = require('./issueProcessor');
const { GetTemplates } = require('./templates');
const config = require('./config');

// Function to listen for ESC key press
function setupEscListener() {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on('keypress', (str, key) => {
        if (key.name === 'escape') {
            console.log('\nProcess cancelled.');
            process.exit();
        }
    });
}

async function obtainValidSession() {
    let sessionCookie = loadSessionCookie();

    if (sessionCookie && await validateJiraSession(sessionCookie)) {
        return sessionCookie;
    }

    let attempts = 3;
    while (attempts > 0) {
        const { username, password } = await captureLogin();

        try {
            sessionCookie = await loginToJira(username, password);
            return sessionCookie;
        } catch (error) {
            console.error(error.message);
            attempts -= 1;
            console.log(`Attempts remaining: ${attempts}`);
        }
    }

    throw new Error('Failed to log in after multiple attempts.');
}

async function displayAndProcessTemplates(sessionCookie) {
    const templates = GetTemplates();

    if (templates.length === 0) {
        console.error('No templates available to select.');
        return;
    }

    const selectedFile = await displayFileList(templates);

    console.log('Selected template:', selectedFile.name);

    if (!selectedFile || !selectedFile.data) {
        console.error('Invalid file format: Data object is missing.');
        return;
    }

    const { Prompt: prompt, Mappings: mappings, Structure: structure } = selectedFile.data;

    console.log(prompt);

    // Initialize issueKeysByRefId within the function
    const issueKeysByRefId = new Map();

    // Prompt the user for unique values
    const uniquePlaceholders = extractUniquePlaceholders(mappings, structure);
    const uniqueValues = await promptForUniqueValues(uniquePlaceholders);

    // Process issues based on the selected template, passing issueKeysByRefId
    await processIssues(mappings, structure, sessionCookie, issueKeysByRefId, uniqueValues);
    console.log('Issues created successfully');
}





async function main() {
    setupEscListener();  // Set up the ESC key listener

    console.log('Welcome! Connecting to: ' + config.JIRA_URL);

    try {
        const sessionCookie = await obtainValidSession();

        // Get and display Jira user information
        try {
            const userInfo = await getJiraUserInfo(sessionCookie);
            console.log('Success! Authenticated as:', userInfo.displayName);
        } catch (error) {
            console.error('Error retrieving user information:', error.message);
            return; // Exit if unable to retrieve user info
        }

        // Display and process templates
        await displayAndProcessTemplates(sessionCookie);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Function to log the nested structure
/*async function logNestedStructure(issueKey) {
    console.log("hi");
    const linkedIssues = await retrieveChildren(issueKey);

    // Create a map to organize issues by depth
    const issuesByDepth = new Map();
    linkedIssues.forEach(issue => {
        if (!issuesByDepth.has(issue.depth)) {
            issuesByDepth.set(issue.depth, []);
        }
        issuesByDepth.get(issue.depth).push(issue);
    });

    // Log the nested structure
    for (let depth = 0; issuesByDepth.has(depth); depth++) {
        const issues = issuesByDepth.get(depth);
        issues.forEach(issue => {
            console.log(' '.repeat(depth * 2) + `${issue.issueType} - ${issue.issueKey} - ${issue.summary}`);
        });
    }
}

logNestedStructure('STN-2322');
*/

// Call the main function
main();
