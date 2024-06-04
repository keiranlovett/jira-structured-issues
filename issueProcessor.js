const { createIssueInJira } = require('./jiraApi');
const { replacePlaceholders } = require('./utils');
const reservedKeys = ['parentKey', 'epicKey'];

function extractUniquePlaceholders(mappings, structure) {
    const uniquePlaceholders = new Set();

    function findUniquePlaceholders(item, key = null) {
        if (reservedKeys.includes(key)) {
            return; // Skip reserved keys
        }

        if (typeof item === 'object') {
            for (const [k, value] of Object.entries(item)) {
                findUniquePlaceholders(value, k);
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
        for (const [key, fieldValue] of Object.entries(mapping.fields)) {
            findUniquePlaceholders(fieldValue, key);
        }
        if (mapping.update) {
            for (const [key, updateValue] of Object.entries(mapping.update)) {
                findUniquePlaceholders(updateValue, key);
            }
        }
    }

    structure.forEach(item => findUniquePlaceholders(item));

    return uniquePlaceholders;
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

module.exports = { extractUniquePlaceholders, processIssues };
