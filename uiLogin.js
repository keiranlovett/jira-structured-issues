const prompts = require('prompts');

// Function to capture user input for login
function captureLogin() {

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

    return prompts(questions);
}

module.exports = { captureLogin };
