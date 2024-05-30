// Core modules
const readline = require('readline');

// Custom modules
const { LoginJira, ValidateJiraSession, LoadSession, GetJiraUser } = require('./jiraApi');
const { PromptLogin, PromptUniqueValues, DisplayFileList, RetryAsyncFunction } = require('./uiPrompts');
const { CreateIssuesFromTemplate, ExtractUniquePlaceholders } = require('./issueProcessor');
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


async function GetJiraSession() {
    let sessionCookie = LoadSession();

    if (sessionCookie && await ValidateJiraSession(sessionCookie)) {
        return sessionCookie;
    }

    let attempts = 3;
    while (attempts > 0) {
        const { username, password } = await PromptLogin();

        try {
            sessionCookie = await LoginJira(username, password);
            return sessionCookie;
        } catch (error) {
            console.error(error.message);
            attempts -= 1;
            console.log(`Attempts remaining: ${attempts}`);
        }
    }

    throw new Error('Failed to log in after multiple attempts.');
}

async function SelectTemplates(sessionCookie) {
    const templates = GetTemplates();

    if (templates.length === 0) {
        console.error('No templates available to select.');
        return;
    }

    const selectedFile = await DisplayFileList(templates);

    console.log('Selected template:', selectedFile.name);

    if (!selectedFile || !selectedFile.data) {
        console.error('Invalid file format: Data object is missing.');
        return;
    }

    const { Prompt: prompt, Mappings: mappings, Structure: structure } = selectedFile.data;

    config.debug(prompt);

    let attempts = 3;

    try {
        await RetryAsyncFunction(
            () => BuildIssues(mappings, structure, sessionCookie), 
            attempts
        );
        console.log('Issues created successfully');
    } catch (error) {
        console.error('Function failed after maximum retries:', error);
    }

}

async function BuildIssues(mappings, structure, sessionCookie) {
    // Initialize issueKeysByRefId within the function
    const issueKeysByRefId = new Map();

    // Prompt the user for unique values
    const uniquePlaceholders = ExtractUniquePlaceholders(mappings, structure);
    const uniqueValues = await PromptUniqueValues(uniquePlaceholders);

    // Process issues based on the selected template, passing issueKeysByRefId
    try {
        await CreateIssuesFromTemplate(mappings, structure, sessionCookie, issueKeysByRefId, uniqueValues);
        console.log('Issues created successfully');
    } catch (error) {
        console.error('There was an error creating the Issue:', error);
        throw error; // Propagate the error to allow retry logic to catch it
    }
}

async function main() {
    setupEscListener();  // Set up the ESC key listener

    console.log('Welcome! Connecting to: ' + config.JIRA_URL);

    try {
        const sessionCookie = await GetJiraSession();

        // Get and display Jira user information
        try {
            const userInfo = await GetJiraUser(sessionCookie);
            console.log('Success! Authenticated as:', userInfo.displayName);
        } catch (error) {
            console.error('Error retrieving user information:', error.message);
            return; // Exit if unable to retrieve user info
        }

        // Display and process templates
        await SelectTemplates(sessionCookie);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Call the main function
main();
