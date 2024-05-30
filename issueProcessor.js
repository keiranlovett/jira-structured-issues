const prompts = require('prompts');
const { createIssueInJira } = require('./jiraApi');
const { replacePlaceholders } = require('./utils');

// Define reserved keys
const reservedKeys = ['parentKey', 'epicKey'];

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
                uniquePlaceholders.add(match[1]);
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

async function processIssues(mappings, structure, sessionCookie, uniqueValues = {}, parentKey = null) {
    for (const item of structure) {
        const mappingTemplate = mappings[item.type];

        if (!mappingTemplate) {
            console.error(`Error processing issues: Mapping template for type '${item.type}' not found`);
            continue;
        }

        const issueData = {
            fields: {},
            update: {}
        };

        for (const [fieldName, fieldValue] of Object.entries(mappingTemplate.fields)) {
            let processedValue = fieldValue;
            if (item.hasOwnProperty(fieldName)) {
                processedValue = replacePlaceholders(item[fieldName], { ...item, ...uniqueValues });
            } else {
                processedValue = replacePlaceholders(fieldValue, { ...item, ...uniqueValues });
            }
            issueData.fields[fieldName] = processedValue;
        }

        if (mappingTemplate.update) {
            issueData.update = {};
            for (const [updateField, updateValue] of Object.entries(mappingTemplate.update)) {
                let processedUpdateValue = updateValue;
                if (item.hasOwnProperty(updateField)) {
                    processedUpdateValue = replacePlaceholders(item[updateField], { ...item, ...uniqueValues });
                } else {
                    processedUpdateValue = replacePlaceholders(updateValue, { ...item, ...uniqueValues });
                }
                issueData.update[updateField] = processedUpdateValue;
            }
        }

        if (parentKey) {
            issueData.fields = replacePlaceholders(issueData.fields, { parentKey });
            issueData.update = replacePlaceholders(issueData.update, { parentKey });
        }

        console.log("Processed issue data:", JSON.stringify(issueData, null, 2));

        const issue = await createIssueInJira(issueData, sessionCookie);

        if (item.items && item.items.length > 0) {
            const newUniqueValues = { ...uniqueValues, parentKey: issue.key };
            await processIssues(mappings, item.items, sessionCookie, newUniqueValues, issue.key);
        }
    }
}

module.exports = {
    promptForUniqueValues,
    processIssues
};
