# jira-structured-issues

This tool is designed to streamline the process of creating Jira issues by providing predefined templates. It allows developers to quickly generate issues with little manual effort and ensuring consistency in issue creation.

## Features

- **Template-Based Issue Creation**: Define issue templates in YAML format, specifying the types of Issues through their fields and mappings in Jira.

## Installation

1. Ensure you have Node.js installed on your machine.
2. Clone the repository to your local machine:

    ```bash
    git clone https://github.com/your-username/jira-issue-creation-tool.git
    ```
3. Install dependencies using npm:

    ```bash
    npm install
    ```

## Configuration

### Setup

Modify the `config.js` file to configure the tool according to your Jira instance:

- `JIRA_PORT`: Port used for connecting to the Jira server (if necessary).
- `JIRA_SERVER`: Hostname of the Jira server.
- `JIRA_PROTOCOL`: Protocol used for communication with the Jira server (default is HTTPS).


### Adding Templates
To add custom templates to the tool, follow these steps:

1. Locate the templates directory within the project's root directory.
2. Create a new YAML file within the templates directory for your template. Name the file descriptively to indicate its purpose or the type of issues it will create.
3. Open the YAML file using a text editor and define the structure of your template. Follow the instructions in Building Templates section
4. Configure Placeholders - Use placeholders within the template to dynamically populate field values based on user input. Define placeholders for values that may vary between different issues or need to be provided by the user during issue creation.
5. Save the YAML file within the templates directory once you've defined the template structure and configured placeholders.
6. Open `templates.yaml` YAML file within the projects root directory.
7. Add a new section to the yaml with the relative path to your recently created template file and the user-friendly name you want to add.

### Building Templates
The tool allows users to define issue templates using YAML files. These templates specify the structure of issues along with their corresponding fields.

Placeholders are used to dynamically populate field values based on user input.

#### Template Structure
Each template consists of the following components:

- Prompt: A user-friendly prompt displayed when the template is selected, guiding users on what inputs are required.
- Mappings: Specifying the Issue type and the desired mappings within Jira. Can include fields like Summary, Reporter, Components or any custom fields the user desires.
- Structure: Describes the hierarchical structure of the Jira Issues within the template. Each item in the structure can have its own set of fields defined and links to other fields.

#### Example Template
Below is an example of a template defined in YAML format:

```yaml
Prompt: "Feature request template"
Mappings:
  Epic:
    fields:
      project:
        key: PROJ
      issuetype:
        name: Epic
      summary: "{feature}"
      reporter:
        name: "{reporter}"
  Story:
    fields:
      project:
        key: PROJ
      issuetype:
        name: Story
      summary: ""
      reporter:
        name: "{reporter}"
      customfield_12345: "{epicKey}"
Structure:
  - type: Epic
    refId: epic1
    summary: "Feature: {feature}"
    items:
      - type: Story
        summary: "[{feature}] User story 1"
      - type: Story
        summary: "[{feature}] User story 2"
```

In this example:

The prompt instructs users to enter details for a feature request.
Define how fields summary, and reporter are mapped to Jira fields.
The structure outlines an Epic Issue Type with two associated Story Issue Types. 

##### Custom Fields
Jira's custom fields feature allows users to define additional fields beyond the default ones provided by Jira. These custom fields can be tailored to specific project requirements, enabling users to capture and track additional information relevant to their workflows. Each custom field in Jira is assigned a unique field ID, which is used to reference the field programmatically through the Jira API. When interacting with custom fields via the API, users need to specify the field ID to access or manipulate the field's data. To find a custom field use the following tutorial - https://confluence.atlassian.com/jirakb/how-to-find-any-custom-field-s-ids-744522503.html 


#### Dynamic Placeholders
Placeholders help dynamically populate field values aduring the creation of tickets. The user will be prompted to set the according value during the start of creation process.

Within templates, placeholders `keys` are enclosed in curly braces `{}` and can be used within mappings and structure definitions.

```yaml
Mappings:
  Story:
    fields:
      project:
        key: PROJ
      issuetype:
        name: Story
      summary: "{summary}"
      reporter:
        name: "{reporter}"
  Task:
    fields:
      project:
        key: PROJ
      issuetype:
        name: Story
      summary: "{summary}"
      reporter:
        name: "{reporter}"
      customfield_12345: "{epicKey}"
Structure:
  - type: Story
        summary: "Story Example {summary}"
        refId: issueParent
        customfield_19673:
          value: "Q2"
        items:
          - type: Task
            issuelinks:
                type: Relates
                inwardIssue: "{issueRef[issueParent]}"
```
In this example:

`{summary}` and `{reporter}` are placeholders used to dynamically populate the summary and reporter fields, respectively.

`{issueRef[issueParent]}` references the Story Issue's key, which is obtained from the `refId` in the mappings.

##### Reserved Keys
To prevent conflicts and ensure proper functionality, certain `keys` are reserved within the placeholder system. Reserved keys are predefined placeholders that serve specific purposes and should not be overridden or modified. These keys include:
- `parentKey`: Represents the key of the parent issue. Used to establish hierarchical relationships between issues within the template structure.
- `issueRef`: Allows referencing other issues within the template by their reference IDs. This enables linking related issues or retrieving information from previously created issues during the issue creation process.


## Usage

### Running
1. Run the application:

    ```bash
    node main.js
    ```

2. Follow the prompts to log in to your Jira account, select a template, and provide required inputs.

3. Once all inputs are provided, the tool will create corresponding issues in Jira based on the selected template.


### Templates
Create or modify YAML files in the templates directory to define custom templates according to your project's needs.
Define the prompt, mappings, and structure for each template to capture relevant information and create issues accurately.
When running the tool, select the desired template, and follow the prompts to provide input values. The tool will then create corresponding issues in Jira based on the selected template.
Templates provide a flexible and efficient way to standardize issue creation workflows and ensure consistency across projects.


## Contributing

Contributions are welcome! If you encounter any issues or have suggestions for improvements, please open an issue or submit a pull request.

## Jira Integration

The tool integrates with the Jira REST API to interact with Jira instances programmatically. 

Authentication: The tool utilizes user credentials (username and password) to authenticate with the Jira server. Upon successful authentication, the tool receives a session cookie, which is used to maintain the user's session throughout the interaction process.

Endpoints: The tool makes HTTP requests to specific endpoints provided by the Jira API. These endpoints are accessed using standard HTTP methods (e.g., GET, POST, PUT, DELETE) and accept parameters and payloads in JSON format. The tool sends a POST request to the `/rest/api/{version}/issue` endpoint to create a new issue in Jira. The request payload contains the issue details, including project, issue type, summary, and other field values. To learn more about the Jira API visit

## Acknowledgements

- This tool utilizes the [Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/) for interacting with Jira instances.
- Special thanks to the [prompts](https://www.npmjs.com/package/prompts) library for providing an intuitive interface for capturing user input.

---

Feel free to customize the README.md file further based on your project's specific requirements and additional details you'd like to include!