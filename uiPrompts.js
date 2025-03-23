const prompts = require('prompts');

// Function to capture user input for login
async function captureLogin() {
    console.log('You need to login to Jira before further steps!');

    const questions = [
        {
            type: 'text',
            name: 'pat',
            message: 'Jira PAT?',
            validate: pat => pat ? true : 'Personal Access Token is required'
        }
    ];

    return await prompts(questions);
}

// Function to prompt for unique values
async function promptForUniqueValues(uniquePlaceholders) {
    const placeholderValues = {};

    const dropdownRegex = /^(\w+):\s*([^,]+(?:,\s*[^,]+)*)$/;

    for (const placeholder of uniquePlaceholders) {
        const match = placeholder.match(dropdownRegex);

        if (match) {
            const [fullMatch, field, options] = match;
            
            const placeholderDisplayName = field.charAt(0).toUpperCase() + field.slice(1);
            const optionsArray = options.split(',').map(opt => opt.trim());
            const response = await prompts({
                type: 'select',
                name: 'value',
                message: `Please select a value for ${placeholderDisplayName}:`,
                choices: optionsArray.map(option => ({ title: option, value: option }))
            });
            placeholderValues[placeholder] = response.value;
        } else {
            const placeholderDisplayName = placeholder.charAt(0).toUpperCase() + placeholder.slice(1);
            const response = await prompts({
                type: 'text',
                name: 'value',
                message: `Enter value for placeholder: ${placeholderDisplayName}:`,
                validate: value => value ? true : `Value for '${placeholderDisplayName}' is required`
            });
            placeholderValues[placeholder] = response.value;
        }
    }

    return placeholderValues;
}

async function promptForSkipChoice() {
    const response = await prompts({
        type: 'select',
        name: 'epicChoice',
        message: 'A "step" for this item exists in the configuration.',
        choices: [
            { title: 'Continue', value: 'ignore' },
            { title: 'Skip this Item', value: 'skip' },
            { title: 'Replace with existing Jira Ticket', value: 'existing' }
        ]
    });

    return response.epicChoice;
}

async function promptExistingKey() {
    const response = await prompts({
        type: 'text',
        name: 'epicKey',
        message: 'Please enter the existing Jira ticket key:'
    });

    return response.epicKey;
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

module.exports = { captureLogin, promptForUniqueValues, displayFileList, promptExistingKey, promptForSkipChoice };