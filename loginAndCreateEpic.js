const Client = require('node-rest-client').Client;
const fs = require('fs');
const yaml = require('js-yaml');
const config = require('./config');
const prompts = require('prompts');

const client = new Client();

// Provide user credentials, which will be used to log in to JIRA.
const loginArgs = {
    data: {
        "username": "keiran.lovett@gameloft.com",
        "password": "CullinanWest28!"
    },
    headers: {
        "Content-Type": "application/json"
    }
};

// Define reserved keys
const reservedKeys = ['parentKey', 'epicKey'];

// Function to replace placeholders in a string or object with actual data
function replacePlaceholders(value, data) {
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(item => replacePlaceholders(item, data));
    } else {
      const replacedObject = {};
      for (const [key, val] of Object.entries(value)) {
        replacedObject[key] = replacePlaceholders(val, data);
      }
      return replacedObject;
    }
  }

  if (typeof value !== 'string') {
    value = String(value);
  }

  const regex = /{([^{}]+)}/g;
  return value.replace(regex, (match, placeholder) => {
    if (data.hasOwnProperty(placeholder)) {
      return data[placeholder];
    } else {
      return match;
    }
  });
}

// Function to simulate creating issue and log the issue type and data
function createIssueDummy(issueData) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const dummyIssue = {
        key: generateRandomKey(),
        fields: issueData
      };
      console.log('Dummy issue created:', dummyIssue.key);
      console.log('Dummy issue body:', JSON.stringify(issueData, null, 5));

      resolve(dummyIssue);
    }, 500);
  });
}

function generateRandomKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 3; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `DUMMY-${key}`;
}

// Function to prompt the user for unique placeholder values in mappings and structure
async function promptForUniqueValues(mappings, structure) {
  const uniquePlaceholders = new Set();

  function findUniquePlaceholders(item) {
    if (typeof item === 'object') {
      for (const value of Object.values(item)) {
        findUniquePlaceholders(value);
      }
    } else if (typeof item === 'string') {
      const regex = /{([^{}]+)}/g;
      let match;
      while ((match = regex.exec(item)) !== null) {
        if (!reservedKeys.includes(match[1])) {
          uniquePlaceholders.add(match[1]);
        }
      }
    }
  }

  for (const mapping of Object.values(mappings)) {
    for (const fieldValue of Object.values(mapping.fields)) {
      findUniquePlaceholders(fieldValue);
    }
    if (mapping.update) {
      for (const updateValue of Object.values(mapping.update)) {
        findUniquePlaceholders(updateValue);
      }
    }
  }

  structure.forEach(findUniquePlaceholders);

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

async function processIssues(items, parentKey = null, parentType = null, uniqueValues = {}) {
  for (const item of items) {
    console.log("Processing item:", item);

    const mappingTemplate = mappings[item.type];

    if (!mappingTemplate) {
      console.error(`Error processing issues: Mapping template for type '${item.type}' not found`);
      continue;
    }

    const issueData = {
      fields: { ...mappingTemplate.fields }, // Start with fields from the mapping template
      update: {},
    };

    // Merge fields from structure, overriding values from mappings where applicable
    for (const [fieldName, fieldValue] of Object.entries(item)) {
      // Check if the field exists in the issueData (from mappings)
      if (issueData.fields.hasOwnProperty(fieldName)) {
        // Replace the value from mappings with the value from the structure
        issueData.fields[fieldName] = fieldValue;
      } 
    }

    // Replace placeholders in the values
    for (const [field, value] of Object.entries(issueData.fields)) {
      issueData.fields[field] = replacePlaceholders(value, { ...item, ...uniqueValues });
    }

    // Process fields within the 'update' object of the mapping template
    if (mappingTemplate.update) {
      for (const [updateField, updateValue] of Object.entries(mappingTemplate.update)) {
        let processedUpdateValue = updateValue;

        // Check if the field exists in the current item's structure
        if (item.hasOwnProperty(updateField)) {
          // Replace placeholders in the value with actual data
          processedUpdateValue = replacePlaceholders(item[updateField], { ...item, ...uniqueValues });
        }

        issueData.update[updateField] = processedUpdateValue;
      }
    }

    // Replace reserved keys if necessary
    if (parentKey) {
      issueData.fields = replacePlaceholders(issueData.fields, { parentKey });
      issueData.update = replacePlaceholders(issueData.update, { parentKey });
    }

    console.log("Processed issue data:", JSON.stringify(issueData, null, 2));

    // Create the issue
    const issue = await createIssueDummy(issueData);

    // Process sub-items if any
    if (item.items && item.items.length > 0) {
      const newUniqueValues = { ...uniqueValues, parentKey: issue.key };
      await processIssues(item.items, issue.key, item.type, newUniqueValues);
    }
  }
}


// Load issue template from YAML file
const fileContents = fs.readFileSync('templates/art-template.yaml', 'utf8');
const { Mappings: mappings, Structure: structure } = yaml.load(fileContents);

// Main function to process issues
async function main() {
  // Prompt the user for unique values
  const uniqueValues = await promptForUniqueValues(mappings, structure);

  // Process issues with user-provided values
  await processIssues(structure, null, null, uniqueValues)
    .then(() => console.log('Issues created successfully'))
    .catch(error => console.error('Error processing issues:', error));
}



// Call the main function
main();
