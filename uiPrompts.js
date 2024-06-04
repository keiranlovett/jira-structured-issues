const prompts = require('prompts');

// Function to capture user input for login
async function captureLogin() {
    console.log('You need to login to Jira before further steps!');

    const questions = [
        {
            type: 'text',
            name: 'username',
            message: 'Jira Username?'
        },
        {
            type: 'password',
            name: 'password',
            message: 'Jira Password?'
        }
    ];

    return await prompts(questions);
}

// Function to prompt for unique values
// Function to prompt for unique values
async function promptForUniqueValues(uniquePlaceholders) {
    const placeholderValues = {};

    for (const placeholder of uniquePlaceholders) {
        const response = await prompts({
            type: 'text',
            name: 'value',
            message: `Enter value for placeholder '{${placeholder}}':`
        });
        placeholderValues[placeholder] = response.value;
    }

    return placeholderValues;
}

// Function to display the file list and prompt for a selection
async function displayFileList(templates) {
    const choices = templates.map(template => ({
        title: template.name,
        value: template
    }));

    const response = await prompts({
        type: 'select',
        name: 'file',
        message: 'Select a template:',
        choices: choices
    });

    return response.file;
}

module.exports = { captureLogin, promptForUniqueValues, displayFileList };
