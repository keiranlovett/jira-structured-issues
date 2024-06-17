const ProgressBar = require('progress');
const { inspect } = require('util');

const { createIssueInJira } = require('./jiraApi');
const config = require('./config');

// Define reserved keys and create a Map for issue references
const reservedKeys = ['parentKey', 'issueRef'];
const refIssueRegex = /{issueRef\[(.+?)\]}/g;
const placeholderRegex = /{([^{}]+)}/g;


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

// Function to merge a complex value into an object at a specified path
function mergeValueIntoObject(obj, path, complexValue) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
            current[keys[i]] = {};
        }
        current = current[keys[i]];
    }

    const lastKey = keys[keys.length - 1];
    current[lastKey] = complexValue;

    return obj; // Return the modified object
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


// Merge the complex description value into the fields object at the specified path
// Only needed for v3 API
/*issueData.fields = mergeValueIntoObject(issueData.fields, 'description', {
    "type": "doc",
    "version": 1,
    "content": [
        {
            "type": "paragraph",
            "content": [
                {
                    "type": "text",
                    "text": issueData.fields.description
                }
            ]
        }
    ]
});*/

// Debug log to verify the updated fields object
console.log("Processed fields:", JSON.stringify(issueData, null, 4));

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
async function processIssuesRecursive(mappings, items, sessionCookie, issueKeysByRefId, uniqueValues = {}, parentKey = null) {

    // Initialize the progress bar
    //console.log(`Creating '${item.type}'`);
    const bar = new ProgressBar(':bar :current/:total', { total: items.length });

    for (const item of items) {
        const mappingTemplate = mappings[item.type];
        if (!mappingTemplate) {
            console.error(`Error processing issues: Mapping template for type '${item.type}' not found`);
            continue;
        }

        const issueData = processIssueData(mappingTemplate, item, uniqueValues, parentKey, issueKeysByRefId);
        const issueLinks = processIssueLinks(item, issueKeysByRefId);
        
        if (!Array.isArray(issueData.update.issuelinks)) {
            issueData.update.issuelinks = []; // Initialize issuelinks as an empty array
        }
        
        issueData.update.issuelinks.push(...issueLinks);

        const inspectedString = inspect(issueData, { depth: null, colors: true });
        config.debug("Processed issue data:", inspectedString);

        const issue = await createIssueInJira(issueData, sessionCookie);

        bar.tick(); // Update the progress bar after each successful request

        if (item.refId) {
            issueKeysByRefId.set(item.refId, issue.key);
        }

        if (item.items && item.items.length > 0) {
            const newUniqueValues = { ...uniqueValues, parentKey: issue.key };
            await processIssuesRecursive(mappings, item.items, sessionCookie, issueKeysByRefId, newUniqueValues, issue.key);
        }
    }
}

module.exports = { extractUniquePlaceholders, processIssuesRecursive };
