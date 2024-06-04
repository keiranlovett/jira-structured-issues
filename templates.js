const fs = require('fs');
const yaml = require('js-yaml');

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
    const filePath = "templates/templates.yaml";
    
    if (!fs.existsSync(filePath)) {
        console.error('Error: templates.yaml file is missing.');
        return [];
    }

    const config = loadYAMLFile(filePath);

    if (!config || !Array.isArray(config.files) || config.files.length === 0) {
        console.error('Error: templates.yaml is empty or invalid.');
        return [];
    }

    // Load each YAML file
    const loadedFiles = config.files.map(file => {
        const data = loadYAMLFile(file.path);
        return { name: file.name, data };
    });

    return loadedFiles;
}

module.exports = { GetTemplates };
