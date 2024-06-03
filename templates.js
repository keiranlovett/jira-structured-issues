const fs = require('fs');
const yaml = require('js-yaml');
const prompts = require('prompts');


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
    // Read and parse the templates.yaml file
    try {
        const config = loadYAMLFile("templates/templates.yaml")

        // Ensure config has a list of file paths
        if (!config || !Array.isArray(config.files)) {
            throw new Error('Invalid templates.yaml format: missing or invalid files array.');
        }

        // Load each YAML file
        const loadedFiles = config.files.map(file => {
            const data = loadYAMLFile(file.path);
            return { name: file.name, data };
        });

        return loadedFiles; // Return the loaded files array
    } catch (error) {
        console.error('Error parsing templates.yaml:', error);
        return []; // Return an empty array in case of error
    }
}

module.exports = { displayFileList };
