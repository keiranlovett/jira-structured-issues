const prompts = require('prompts');

// Function to capture user input for login
async function PromptLogin() {
    console.log('You need to login to Jira before further steps!');

    const questions = [
        {
            type: 'text',
            name: 'username',
            message: 'Jira Username?',
            validate: username => username ? true : 'Username is required'
        },
        {
            type: 'password',
            name: 'password',
            message: 'Jira Password?',
            validate: password => password ? true : 'Password is required'
        }
    ];

    return await prompts(questions);
}

// Function to prompt for unique values
async function PromptUniqueValues(uniquePlaceholders) {
    const placeholderValues = {};

    for (const placeholder of uniquePlaceholders) {
        const placeholderDisplayName = placeholder.charAt(0).toUpperCase() + placeholder.slice(1);
        const response = await prompts({
            type: 'text',
            name: 'value',
            message: `Enter value for placeholder: ${placeholderDisplayName}:`,
            validate: value => value ? true : `Value for '${placeholderDisplayName}' is required`
        });
        placeholderValues[placeholder] = response.value;
    }

    return placeholderValues;
}

// Function to display the file list and prompt for a selection
async function DisplayFileList(templates) {
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

async function RetryAsyncFunction(fn, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            console.log(`${error.message}`);

            if (attempt === retries) {
                throw error;
            }

            // Prompt user to retry
            const response = await prompts({
                type: 'confirm',
                name: 'retry',
                message: `Attempt ${attempt} failed. Would you like to retry?`
            });

            if (!response.retry) {
                throw new Error('User opted to not retry after failure');
            }
        }
    }
}

module.exports = { PromptLogin, PromptUniqueValues, DisplayFileList, RetryAsyncFunction };