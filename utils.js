

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
