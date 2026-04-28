'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const builderPath = path.join(root, 'recipe-builder.js');
const workflowPath = path.join(root, 'danger-chili-intake.workflow.json');
const builderCode = fs.readFileSync(builderPath, 'utf8');

const n8nCode = `${builderCode}

const result = buildRecipe($input.first().json, DEFAULT_CONFIG, {
  executionId: $execution.id
});

if (result.validationErrors.length) {
  throw new Error(result.validationErrors.join(' '));
}

return [{ json: result }];
`;

const githubHeaders = {
  parameters: [
    {
      name: 'Accept',
      value: 'application/vnd.github+json'
    },
    {
      name: 'Authorization',
      value: '={{ "Bearer " + $vars.GITHUB_TOKEN }}'
    },
    {
      name: 'X-GitHub-Api-Version',
      value: '2026-03-10'
    },
    {
      name: 'User-Agent',
      value: 'n8n-danger-chili'
    }
  ]
};

function httpNode(id, name, method, url, jsonBody, position) {
  const parameters = {
    method,
    url,
    sendHeaders: true,
    headerParameters: githubHeaders,
    options: {}
  };

  if (jsonBody) {
    parameters.sendBody = true;
    parameters.specifyBody = 'json';
    parameters.jsonBody = jsonBody;
  }

  return {
    parameters,
    id,
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position
  };
}

const workflow = {
  name: 'Danger-Chili Intake to GitHub PR',
  nodes: [
    {
      parameters: {
        formTitle: 'Danger-Chili: Hack My Chili Recipe Intake',
        formDescription: 'Submit a chili recipe for cookbook review. Only public recipe text and credit details should be entered here.',
        formFields: {
          values: [
            { fieldLabel: 'Contest Year', fieldName: 'contest_year', fieldType: 'number', requiredField: true },
            { fieldLabel: 'Public Display Name', fieldName: 'display_name', requiredField: true },
            { fieldLabel: 'Hacker Handle', fieldName: 'hacker_handle' },
            { fieldLabel: 'Public Credit URL', fieldName: 'credit_url' },
            { fieldLabel: 'Recipe Name', fieldName: 'recipe_name', requiredField: true },
            { fieldLabel: 'Recipe Story', fieldName: 'recipe_story', fieldType: 'textarea' },
            { fieldLabel: 'Chili Style', fieldName: 'chili_style' },
            { fieldLabel: 'Heat Level', fieldName: 'heat_level' },
            { fieldLabel: 'Servings', fieldName: 'servings' },
            { fieldLabel: 'Prep Time', fieldName: 'prep_time' },
            { fieldLabel: 'Cook Time', fieldName: 'cook_time' },
            { fieldLabel: 'Ingredients', fieldName: 'ingredients', fieldType: 'textarea', requiredField: true },
            { fieldLabel: 'Instructions', fieldName: 'instructions', fieldType: 'textarea', requiredField: true },
            { fieldLabel: 'How I Hack My Chili', fieldName: 'hack_story', fieldType: 'textarea', requiredField: true },
            { fieldLabel: 'Serving Notes', fieldName: 'serving_notes', fieldType: 'textarea' },
            { fieldLabel: 'Allergens or Dietary Notes', fieldName: 'allergens', fieldType: 'textarea' },
            { fieldLabel: 'I have the right to share this recipe under the cookbook license', fieldName: 'consent_license', fieldType: 'checkbox', requiredField: true },
            { fieldLabel: 'I understand the chosen credit name, story, and recipe text will be public', fieldName: 'consent_public', fieldType: 'checkbox', requiredField: true }
          ]
        },
        options: {
          ignoreBots: true,
          buttonLabel: 'Submit Recipe'
        }
      },
      id: 'form-trigger',
      name: 'Chili Entry Form',
      type: 'n8n-nodes-base.formTrigger',
      typeVersion: 2.2,
      position: [-680, 0],
      webhookId: 'replace-after-import'
    },
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: n8nCode
      },
      id: 'build-recipe',
      name: 'Build Recipe Markdown',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [-420, 0]
    },
    httpNode(
      'get-base-ref',
      'Get Base Ref',
      'GET',
      "=https://api.github.com/repos/{{ $('Build Recipe Markdown').item.json.github.sourceOwner }}/{{ $('Build Recipe Markdown').item.json.github.sourceRepo }}/git/ref/heads/{{ $('Build Recipe Markdown').item.json.github.baseBranch }}",
      null,
      [-160, 0]
    ),
    httpNode(
      'create-branch',
      'Create Branch',
      'POST',
      "=https://api.github.com/repos/{{ $('Build Recipe Markdown').item.json.github.sourceOwner }}/{{ $('Build Recipe Markdown').item.json.github.sourceRepo }}/git/refs",
      `={
  "ref": "refs/heads/" + $('Build Recipe Markdown').item.json.branchName,
  "sha": $json.object.sha
}`,
      [100, 0]
    ),
    httpNode(
      'create-recipe-file',
      'Create Recipe File',
      'PUT',
      "=https://api.github.com/repos/{{ $('Build Recipe Markdown').item.json.github.sourceOwner }}/{{ $('Build Recipe Markdown').item.json.github.sourceRepo }}/contents/{{ $('Build Recipe Markdown').item.json.filePath }}",
      "={{ $('Build Recipe Markdown').item.json.githubFileBody }}",
      [360, 0]
    ),
    httpNode(
      'create-pr',
      'Create Pull Request',
      'POST',
      "=https://api.github.com/repos/{{ $('Build Recipe Markdown').item.json.github.targetOwner }}/{{ $('Build Recipe Markdown').item.json.github.targetRepo }}/pulls",
      "={{ $('Build Recipe Markdown').item.json.pullRequestBody }}",
      [620, 0]
    )
  ],
  connections: {
    'Chili Entry Form': {
      main: [[{ node: 'Build Recipe Markdown', type: 'main', index: 0 }]]
    },
    'Build Recipe Markdown': {
      main: [[{ node: 'Get Base Ref', type: 'main', index: 0 }]]
    },
    'Get Base Ref': {
      main: [[{ node: 'Create Branch', type: 'main', index: 0 }]]
    },
    'Create Branch': {
      main: [[{ node: 'Create Recipe File', type: 'main', index: 0 }]]
    },
    'Create Recipe File': {
      main: [[{ node: 'Create Pull Request', type: 'main', index: 0 }]]
    }
  },
  settings: {
    executionOrder: 'v1'
  },
  pinData: {},
  meta: {
    templateCredsSetupCompleted: false
  }
};

fs.writeFileSync(workflowPath, `${JSON.stringify(workflow, null, 2)}\n`);
console.log(`Wrote ${workflowPath}`);
