const { loginToJira, saveSessionCookie, loadSessionCookie } = require('./jiraApi');
const { captureLogin } = require('./uiLogin');
const { processIssues, promptForUniqueValues } = require('./issueProcessor');
const yaml = require('js-yaml');
const fs = require('fs');


// Main function to process issues
async function main() {
    try {
        // Load session cookie if it exists
        let sessionCookie = loadSessionCookie();

        if (!sessionCookie) {
            // Capture login details from the user
            const { username, password } = await captureLogin();

            // Log in to Jira and obtain session cookie
            sessionCookie = await loginToJira(username, password);
        }

         // Load issue template from YAML file
        const fileContents = fs.readFileSync('templates/art-template.yaml', 'utf8');
        const { Mappings: mappings, Structure: structure } = yaml.load(fileContents);

        // Prompt the user for unique values
        const uniqueValues = await promptForUniqueValues(mappings, structure);

        // Process issues with user-provided values
        await processIssues(mappings, structure, sessionCookie, uniqueValues);
        
        console.log('Issues created successfully');

    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Call the main function
main();
