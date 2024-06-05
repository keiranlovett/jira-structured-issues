const { createIssueInJira } = require('./jiraApi');

// Define reserved keys and create a Map for issue references
const reservedKeys = ['parentKey', 'issueRef'];

// Function to extract unique placeholders from mappings and structure
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
                const placeholder = match[1];
                if (!reservedKeys.some(reserved => placeholder.startsWith(reserved))) {
                    uniquePlaceholders.add(placeholder);
                }
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

// Function to replace placeholders related to issue references
function replaceIssueRefPlaceholder(value, issueKeysByRefId) {
    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            return value.map(item => replaceIssueRefPlaceholder(item, issueKeysByRefId));
        } else {
            const replacedObject = {};
            for (const [key, val] of Object.entries(value)) {
                replacedObject[key] = replaceIssueRefPlaceholder(val, issueKeysByRefId);
            }
            return replacedObject;
        }
    }

    if (typeof value !== 'string') {
        value = String(value);
    }

    const regex = /{issueRef\[(.+?)\]}/g;
    return value.replace(regex, (match, refId) => {
        const issueKey = issueKeysByRefId.get(refId);
        return issueKey || match;
    });
}

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

// Function to process issues recursively
async function processIssues(mappings, structure, sessionCookie, issueKeysByRefId, uniqueValues = {}, parentKey = null) {
    for (const item of structure) {
        const mappingTemplate = mappings[item.type];

        if (!mappingTemplate) {
            console.error(`Error processing issues: Mapping template for type '${item.type}' not found`);
            continue;
        }

        const issueData = {
            fields: {},
            update: {
                issuelinks: []
            }
        };

        // Populate issueData with fields from mappingTemplate
        for (const [fieldName, fieldValue] of Object.entries(mappingTemplate.fields)) {
            let processedValue = fieldValue;
            if (item.hasOwnProperty(fieldName)) {
                processedValue = replacePlaceholders(item[fieldName], { ...item, ...uniqueValues });
            } else {
                processedValue = replacePlaceholders(fieldValue, { ...item, ...uniqueValues });
            }
            issueData.fields[fieldName] = processedValue;
        }

        // Populate update section of issueData if mappingTemplate has an update section
        if (mappingTemplate.update) {
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

        // Replace parentKey placeholders if parentKey is provided
        if (parentKey) {
            issueData.fields = replacePlaceholders(issueData.fields, { parentKey });
            issueData.update = replacePlaceholders(issueData.update, { parentKey });
        }

        // Replace placeholders related to issue references
        issueData.fields = replaceIssueRefPlaceholder(issueData.fields, issueKeysByRefId);
        issueData.update = replaceIssueRefPlaceholder(issueData.update, issueKeysByRefId);

        // Handle issuelinks directly in the structure
        if (item.issuelinks) {
            const linkType = item.issuelinks.type;
            const inwardIssue = replaceIssueRefPlaceholder(item.issuelinks.inwardIssue, issueKeysByRefId); // Replace placeholder with actual issue key
            issueData.update.issuelinks.push({
                add: {
                    type: { name: linkType },
                    inwardIssue: { key: inwardIssue }
                }
            });
        }

        console.log("Processed issue data:", JSON.stringify(issueData, null, 2));

        // Create issue in Jira using the processed issueData
        const issue = await createIssueInJira(issueData, sessionCookie);

        // Store issue key if refId is provided in the item
        if (item.refId) {
            issueKeysByRefId.set(item.refId, issue.key);
        }

        // Recursively process nested items if present
        if (item.items && item.items.length > 0) {
            const newUniqueValues = { ...uniqueValues, parentKey: issue.key };
            await processIssues(mappings, item.items, sessionCookie, issueKeysByRefId, newUniqueValues, issue.key);
        }
    }
}

module.exports = { extractUniquePlaceholders, processIssues };
