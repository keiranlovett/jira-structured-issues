const { CreateIssueInJira } = require('./jiraApi');
const config = require('./config');

// Define reserved keys and create a Map for issue references
const reservedKeys = ['parentKey', 'issueRef'];
const refIssueRegex = /{issueRef\[(.+?)\]}/g;
const placeholderRegex = /{([^{}]+)}/g;

// Function to extract unique placeholders from mappings and structure
function ExtractUniquePlaceholders(mappings, structure) {
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
            let match;
            while ((match = placeholderRegex.exec(item)) !== null) {
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

    return value.replace(refIssueRegex, (match, refId) => {
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

    return value.replace(placeholderRegex, (match, placeholder) => {
        if (data.hasOwnProperty(placeholder)) {
            return data[placeholder];
        } else {
            return match;
        }
    });
}

// Function to process fields from mapping template
function processFields(mappingTemplate, item, uniqueValues) {
    const processedFields = {};
    for (const [fieldName, fieldValue] of Object.entries(mappingTemplate.fields)) {
        let processedValue = fieldValue;
        if (item.hasOwnProperty(fieldName)) {
            processedValue = replacePlaceholders(item[fieldName], { ...item, ...uniqueValues });
        } else {
            processedValue = replacePlaceholders(fieldValue, { ...item, ...uniqueValues });
        }
        processedFields[fieldName] = processedValue;
    }
    return processedFields;
}

// Function to process update section of issueData
function processUpdate(mappingTemplate, item, uniqueValues) {
    const processedUpdate = { issuelinks: [] };
    if (mappingTemplate.update) {
        for (const [updateField, updateValue] of Object.entries(mappingTemplate.update)) {
            let processedUpdateValue = updateValue;
            if (item.hasOwnProperty(updateField)) {
                processedUpdateValue = replacePlaceholders(item[updateField], { ...item, ...uniqueValues });
            } else {
                processedUpdateValue = replacePlaceholders(updateValue, { ...item, ...uniqueValues });
            }
            processedUpdate[updateField] = processedUpdateValue;
        }
    }
    return processedUpdate;
}

// Function to process issueData for a single item
function processIssueData(mappingTemplate, item, uniqueValues, parentKey, issueKeysByRefId) {
    const issueData = {
        fields: processFields(mappingTemplate, item, uniqueValues),
        update: processUpdate(mappingTemplate, item, uniqueValues)
    };

    // Replace parentKey placeholders if parentKey is provided
    if (parentKey) {
        issueData.fields = replacePlaceholders(issueData.fields, { parentKey });
        issueData.update = replacePlaceholders(issueData.update, { parentKey });
    }

    // Replace placeholders related to issue references
    issueData.fields = replaceIssueRefPlaceholder(issueData.fields, issueKeysByRefId);
    issueData.update = replaceIssueRefPlaceholder(issueData.update, issueKeysByRefId);

    return issueData;
}

// Function to process issuelinks for a single item
function processIssueLinks(item, issueKeysByRefId) {
    const issueLinks = [];
    if (item.issuelinks) {
        const linkType = item.issuelinks.type;
        const inwardIssue = replaceIssueRefPlaceholder(item.issuelinks.inwardIssue, issueKeysByRefId); // Replace placeholder with actual issue key
        issueLinks.push({
            add: {
                type: { name: linkType },
                inwardIssue: { key: inwardIssue }
            }
        });
    }
    return issueLinks;
}

// Recursive function to process issues
async function CreateIssuesFromTemplate(mappings, items, sessionCookie, issueKeysByRefId, uniqueValues = {}, parentKey = null) {
    for (const item of items) {
        try {
            const mappingTemplate = mappings[item.type];
            if (!mappingTemplate) {
                throw new Error(`Mapping template for type '${item.type}' not found`);
            }

            const issueData = processIssueData(mappingTemplate, item, uniqueValues, parentKey, issueKeysByRefId);
            const issueLinks = processIssueLinks(item, issueKeysByRefId);
            
            if (!Array.isArray(issueData.update.issuelinks)) {
                issueData.update.issuelinks = []; // Initialize issuelinks as an empty array
            }
            
            issueData.update.issuelinks.push(...issueLinks);

            config.debug("Processed issue data:", JSON.stringify(issueData, null, 2));

            const issue = await CreateIssueInJira(issueData, sessionCookie);

            console.log("Issue created:", issue.self);

            if (item.refId) {
                issueKeysByRefId.set(item.refId, issue.key);
            }

            if (item.items && item.items.length > 0) {
                const newUniqueValues = { ...uniqueValues, parentKey: issue.key };
                await CreateIssuesFromTemplate(mappings, item.items, sessionCookie, issueKeysByRefId, newUniqueValues, issue.key);
            }
        } catch (error) {
            if (error.errors) {
                // Handle the Jira error without logging it
                // You can also log it conditionally here if needed
                config.debug(`Error processing item of type '${item.type}':`, JSON.stringify(error.errors, null, 2));
            } else {
                // Log other types of errors
                console.error(`Error processing item of type '${item.type}':`, error.message);
            }
            throw error; // Propagate the error to allow retry logic to catch it
        }
    }
}

module.exports = { ExtractUniquePlaceholders, CreateIssuesFromTemplate };
