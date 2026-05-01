'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const builderPath = path.join(root, 'recipe-builder.js');
const workflowPath = path.join(root, 'danger-cookbook-proxy.workflow.json');
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

const buildCreditsCode = `'use strict';

function decodeBase64(value) {
  const compact = String(value || '').replace(/\\s/g, '');

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(compact, 'base64').toString('utf8');
  }

  return decodeURIComponent(escape(atob(compact)));
}

function encodeBase64(value) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64');
  }

  return btoa(unescape(encodeURIComponent(value)));
}

function normalizeForCompare(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function appendCreditsEntry(markdown, entry) {
  const normalizedMarkdown = normalizeForCompare(markdown);
  const normalizedEntry = normalizeForCompare(entry);

  if (normalizedEntry && normalizedMarkdown.includes(normalizedEntry)) {
    return { markdown, added: false };
  }

  const trimmed = markdown.replace(/\\s+$/g, '');
  return {
    markdown: trimmed + '\\n' + entry + '\\n',
    added: true
  };
}

const creditsFile = $input.first().json;
const recipe = $('Build Recipe Markdown').first().json;

if (!creditsFile || !creditsFile.content || !creditsFile.sha) {
  throw new Error('CREDITS.md content and sha are required to update credits.');
}

if (!recipe.credits || !recipe.credits.entry) {
  throw new Error('Recipe credits entry is missing.');
}

const currentMarkdown = decodeBase64(creditsFile.content);
const update = appendCreditsEntry(currentMarkdown, recipe.credits.entry);

return [{
  json: {
    creditsPath: recipe.credits.path,
    creditsEntry: recipe.credits.entry,
    creditsEntryAdded: update.added,
    githubCreditsFileBody: {
      message: recipe.creditsCommitMessage,
      content: encodeBase64(update.markdown),
      branch: recipe.branchName,
      sha: creditsFile.sha
    }
  }
}];
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
      value: 'n8n-danger-cookbook-proxy'
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

const categoryOptions = [
  'APPETIZERS',
  'BREAKFAST',
  'COOKWARE',
  'DESSERTS',
  'DRINKS',
  'ENTREES',
  'SAUCES',
  'SIDES',
  'SNACKS'
].map((option) => ({ option }));

const workflow = {
  name: 'Danger-CookbookProxy',
  nodes: [
    {
      parameters: {
        formTitle: 'Danger-CookbookProxy: Hacker Cookbook Recipe Submission',
        formDescription: 'Submit any recipe for cookbook review. Only public recipe text and credit details should be entered here.',
        formFields: {
          values: [
            {
              fieldLabel: 'Recipe Category',
              fieldName: 'category',
              fieldType: 'dropdown',
              fieldOptions: {
                values: categoryOptions
              },
              requiredField: true
            },
            { fieldLabel: 'Public Display Name', fieldName: 'display_name', requiredField: true },
            { fieldLabel: 'Hacker Handle', fieldName: 'hacker_handle' },
            { fieldLabel: 'Public Credit URL', fieldName: 'credit_url' },
            { fieldLabel: 'Recipe Name', fieldName: 'recipe_name', requiredField: true },
            { fieldLabel: 'Recipe Description', fieldName: 'recipe_description', fieldType: 'textarea' },
            { fieldLabel: 'Servings', fieldName: 'servings' },
            { fieldLabel: 'Prep Time', fieldName: 'prep_time' },
            { fieldLabel: 'Cook Time', fieldName: 'cook_time' },
            { fieldLabel: 'Difficulty', fieldName: 'difficulty' },
            { fieldLabel: 'Ingredients', fieldName: 'ingredients', fieldType: 'textarea', requiredField: true },
            { fieldLabel: 'Optional Ingredients', fieldName: 'optional_ingredients', fieldType: 'textarea' },
            { fieldLabel: 'Hardware or Equipment', fieldName: 'hardware', fieldType: 'textarea' },
            { fieldLabel: 'Instructions', fieldName: 'instructions', fieldType: 'textarea', requiredField: true },
            { fieldLabel: 'Notes', fieldName: 'notes', fieldType: 'textarea' },
            { fieldLabel: 'Tags', fieldName: 'tags' },
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
      name: 'Recipe Submission Form',
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
      "=https://api.github.com/repos/{{ $('Build Recipe Markdown').first().json.github.sourceOwner }}/{{ $('Build Recipe Markdown').first().json.github.sourceRepo }}/git/ref/heads/{{ $('Build Recipe Markdown').first().json.github.baseBranch }}",
      null,
      [-160, 0]
    ),
    httpNode(
      'create-branch',
      'Create Branch',
      'POST',
      "=https://api.github.com/repos/{{ $('Build Recipe Markdown').first().json.github.sourceOwner }}/{{ $('Build Recipe Markdown').first().json.github.sourceRepo }}/git/refs",
      "={{ { ref: 'refs/heads/' + $('Build Recipe Markdown').first().json.branchName, sha: $json.object.sha } }}",
      [100, 0]
    ),
    httpNode(
      'create-recipe-file',
      'Create Recipe File',
      'PUT',
      "=https://api.github.com/repos/{{ $('Build Recipe Markdown').first().json.github.sourceOwner }}/{{ $('Build Recipe Markdown').first().json.github.sourceRepo }}/contents/{{ $('Build Recipe Markdown').first().json.filePath }}",
      "={{ $('Build Recipe Markdown').first().json.githubFileBody }}",
      [360, 0]
    ),
    httpNode(
      'get-credits-file',
      'Get Credits File',
      'GET',
      "=https://api.github.com/repos/{{ $('Build Recipe Markdown').first().json.github.sourceOwner }}/{{ $('Build Recipe Markdown').first().json.github.sourceRepo }}/contents/CREDITS.md?ref={{ encodeURIComponent($('Build Recipe Markdown').first().json.branchName) }}",
      null,
      [620, 0]
    ),
    {
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: buildCreditsCode
      },
      id: 'build-credits-update',
      name: 'Build Credits Update',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [880, 0]
    },
    httpNode(
      'update-credits-file',
      'Update Credits File',
      'PUT',
      "=https://api.github.com/repos/{{ $('Build Recipe Markdown').first().json.github.sourceOwner }}/{{ $('Build Recipe Markdown').first().json.github.sourceRepo }}/contents/{{ $('Build Recipe Markdown').first().json.credits.path }}",
      "={{ $('Build Credits Update').first().json.githubCreditsFileBody }}",
      [1140, 0]
    ),
    httpNode(
      'create-pr',
      'Create Pull Request',
      'POST',
      "=https://api.github.com/repos/{{ $('Build Recipe Markdown').first().json.github.targetOwner }}/{{ $('Build Recipe Markdown').first().json.github.targetRepo }}/pulls",
      "={{ $('Build Recipe Markdown').first().json.pullRequestBody }}",
      [1400, 0]
    )
  ],
  connections: {
    'Recipe Submission Form': {
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
      main: [[{ node: 'Get Credits File', type: 'main', index: 0 }]]
    },
    'Get Credits File': {
      main: [[{ node: 'Build Credits Update', type: 'main', index: 0 }]]
    },
    'Build Credits Update': {
      main: [[{ node: 'Update Credits File', type: 'main', index: 0 }]]
    },
    'Update Credits File': {
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
