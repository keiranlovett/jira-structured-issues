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


module.exports = {
    replacePlaceholders, createIssueDummy
};
