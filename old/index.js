const config = require('./config');
const prompts = require('prompts');
const fs = require('fs');
const yaml = require('js-yaml');
//const loginAndCreateEpic = require('./loginAndCreateEpic'); // Import the function correctly

// Function to load YAML files
function loadYAMLFile(filePath) {
    try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        return yaml.load(fileContents);
    } catch (error) {
        console.error(`Error loading YAML file ${filePath}:`, error);
        return null;
    }
}

function GetTemplates() {
    // Read and parse the config.yaml file
    try {
        const config = loadYAMLFile("templates.yaml")

        // Ensure config has a list of file paths
        if (!config || !Array.isArray(config.files)) {
            throw new Error('Invalid config.yaml format: missing or invalid files array.');
        }

        // Load each YAML file
        const loadedFiles = config.files.map(file => {
            const data = loadYAMLFile(file.path);
            return { name: file.name, data };
        });

        return loadedFiles; // Return the loaded files array
    } catch (error) {
        console.error('Error parsing config.yaml:', error);
        return []; // Return an empty array in case of error
    }
}

// Display welcome message with config settings
async function displayWelcome(callback) {
    try {
    console.log('Welcome! Please verify the following config settings:');
    console.log(`Jira URL: ${config.jiraUrl}`);
    console.log(`Project Key: ${config.projectKey}`);

        // Prompt the user to confirm
        const confirmResponse = await prompts({
            type: 'confirm',
            name: 'confirmed',
            message: 'Can you confirm?',
            initial: true
        });

        if (confirmResponse.confirmed) {
            callback(epicDetails); // Invoke the callback with the captured details
        } else {
            console.log('Confirmation declined. Exiting...');
        }
    } catch (error) {
        console.error('Error capturing epic details:', error);
    }
}

async function displayFileList(callback) {
    const templates = GetTemplates();

    const choices = templates.map(template => {
        return { title: template.name, value: template };
    });

    const response = await prompts({
        type: 'select',
        name: 'file',
        message: 'Select a template:',
        choices: choices
    });

    callback(response.file); // Invoke the callback with the selected file
}


// Example usage:
displayFileList(selectedFile => {
    console.log('Selected template:', selectedFile);
    // Do something with the selected file
});

displayWelcome()

//captureLogin(loginAndCreateEpic)



// Function to capture user input for epic modification
function captureLogin(callback) {

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
      
    (async () => {
        const response = await prompts(questions);
        callback(response); // Invoke the callback with the captured details
    })();

    /*rl.question('Enter Epic Summary: ', (summary) => {
        rl.question('Enter Epic Reporter: ', (reporter) => {
            rl.question('Enter Epic Component: ', (component) => {
                rl.close();
                callback({ summary, reporter, component });
            });
        });
    });*/
}
