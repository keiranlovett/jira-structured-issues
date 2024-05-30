const readline = require('readline');
const loginAndCreateEpic = require('./loginAndCreateEpic'); // Import the function correctly

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to capture user input for epic modification
function captureEpicDetails(callback) {
    rl.question('Enter Epic Summary: ', (summary) => {
        rl.question('Enter Epic Reporter: ', (reporter) => {
            rl.question('Enter Epic Component: ', (component) => {
                rl.close();
                callback({ summary, reporter, component });
            });
        });
    });
}

captureEpicDetails(loginAndCreateEpic);
