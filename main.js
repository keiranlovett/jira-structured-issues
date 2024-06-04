const { loginToJira, validateJiraSession, loadSessionCookie, getJiraUserInfo } = require('./jiraApi');
const { displayFileList, captureLogin, promptForUniqueValues } = require('./uiPrompts');
const { processIssues, extractUniquePlaceholders } = require('./issueProcessor');
const { GetTemplates } = require('./templates');
const readline = require('readline');
const config = require('./config');

// Function to listen for ESC key press
function setupEscListener() {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on('keypress', (str, key) => {
        if (key.name === 'escape') {
            console.log('\nProcess cancelled by user.');
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

        // Get templates and display file list
        const templates = GetTemplates();
        const selectedFile = await displayFileList(templates);

        console.log('Selected template:', selectedFile.name);

        if (!selectedFile || !selectedFile.data) {
            throw new Error('Invalid file format: Data object is missing.');
        }

        const { Mappings: mappings, Structure: structure } = selectedFile.data;

        const uniquePlaceholders = extractUniquePlaceholders(mappings, structure);
        const uniqueValues = await promptForUniqueValues(uniquePlaceholders);

        await processIssues(mappings, structure, sessionCookie, uniqueValues);

        console.log('Issues created successfully');

    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Call the main function
main();
