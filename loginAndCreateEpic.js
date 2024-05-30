const Client = require('node-rest-client').Client;
const fs = require('fs');
const yaml = require('js-yaml');
const config = require('./config');
const client = new Client();

// Load issue template from YAML file
const issueTemplate = yaml.load(fs.readFileSync('./issues-template.yaml', 'utf8'));

// Provide user credentials, which will be used to log in to JIRA.
const loginArgs = {
    data: {
        "username": "keiran.lovett@gameloft.com",
        "password": ""
    },
    headers: {
        "Content-Type": "application/json"
    }
};

// Function to login and create Epic
function loginAndCreateEpic(epicDetails, loginArgs) {

    // Login and create Epic
    client.post(`${config.jiraUrl}/rest/auth/1/session`, loginArgs, function (data, response) {
        if (response.statusCode == 200) {
            console.log('Successfully logged in, session:', data.session);
            const session = data.session;
            const sessionCookie = session.name + '=' + session.value;

            // Function to create an issue in JIRA
            function createIssue(issueData, callback) {
                const createIssueArgs = {
                    headers: {
                        cookie: sessionCookie,
                        "Content-Type": "application/json"
                    },
                    data: issueData
                };

                client.post(`${config.jiraUrl}/rest/api/2/issue`, createIssueArgs, function (issue, response) {
                    if (response.statusCode == 201) {
                        console.log('Issue created:', issue.key);
                        callback(null, issue);
                    } else {
                        console.error('Failed to create issue:', response.statusCode, response.statusMessage);
                        callback(response);
                    }
                });
            }

            var epicName = issueTemplate.epicSummary.replace("{Input}", epicDetails.summary);

            // Create Epic
            const epicData = {
                fields: {
                    project: { key: config.projectKey },
                    summary: epicName,
                    customfield_10672: epicName,
                    issuetype: { name: 'Epic' },
                    reporter: { name: epicDetails.reporter },
                    components: [{ name: epicDetails.component }]
                }
            };


            createIssue(epicData, function (err, epic) {
                if (err) {
                    console.error('Failed to create Epic');
                    return;
                }
                console.log('Epic created, now generating stories...');

            

        // Create Stories and their Tasks
        if (issueTemplate.stories) {
            issueTemplate.stories.forEach(storyTemplate => {
                
                var storyName = storyTemplate.summary.replace("{Input}",  epicDetails.summary);
                const storyData = {
                    fields: {
                        project: { key: config.projectKey },
                        summary: storyName,
                        issuetype: { name: 'Story' },
                        reporter: { name: issueTemplate.reporter },
                        components: [{ name: issueTemplate.component }]
                    }, 
                    update: {
                        issuelinks: [
                            {
                                add: {
                                    type: {
                                        name: "Parent-Child",
                                        inward: "is parent of",
                                        outward: "is child of"
                                    },
                                    inwardIssue: {
                                        key: epic.key
                                    }
                                }
                            }
                        ]
                    }
                };

                createIssue(storyData, function (err, story) {
                    if (err) {
                        console.error(`Failed to create Story: ${storyTemplate.summary}`);
                        return;
                    }
                    console.log('Story created and linked, now creating tasks');

                    // Create Tasks for the Story
                    if (storyTemplate.tasks) {
                        storyTemplate.tasks.forEach(taskTemplate => {

                            var taskName = taskTemplate.summary.replace("{Input}",  epicDetails.summary);
                            const taskData = {
                                fields: {
                                    project: { key: config.projectKey },
                                    summary: taskName,
                                    issuetype: { name: 'Task' },
                                    reporter: { name: issueTemplate.reporter },
                                    components: [{ name: issueTemplate.component }],
                                    customfield_19581: story.key,
                                }, 
                                update: {
                                    issuelinks: [
                                        {
                                            add: {
                                                type: {
                                                    name: "Parent-Child",
                                                    inward: "is parent of",
                                                    outward: "is child of"
                                                },
                                                inwardIssue: {
                                                    key: story.key
                                                }
                                            }
                                        }
                                    ]
                                }
                            };
                            createIssue(taskData, function (err, task) {
                                if (err) {
                                    console.error('Failed to create Task');
                                    return;
                                }
                                console.log('Task created:', task.key);
                                // Add code here to handle next steps, if any
                            });
                        });
                    }
                });


            });
        }

        });

        } else {
            throw "Login failed :(";
        }
    });
    
}

module.exports = loginAndCreateEpic; // Export the function
