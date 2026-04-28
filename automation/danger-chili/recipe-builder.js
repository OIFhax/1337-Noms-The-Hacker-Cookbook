'use strict';

const DEFAULT_CONFIG = {
  sourceOwner: 'OIFhax',
  sourceRepo: '1337-Noms-The-Hacker-Cookbook',
  targetOwner: 'pale-shadow',
  targetRepo: '1337-Noms-The-Hacker-Cookbook',
  baseBranch: 'main',
  categoryDir: 'ENTREES',
  branchPrefix: 'danger-chili'
};

const FIELD_ALIASES = {
  contestYear: ['contest_year', 'contestYear', 'year'],
  displayName: ['display_name', 'displayName', 'name', 'chef_name', 'chefName'],
  hackerHandle: ['hacker_handle', 'hackerHandle', 'handle', 'credit_handle', 'creditHandle'],
  creditUrl: ['credit_url', 'creditUrl', 'profile_url', 'profileUrl'],
  recipeName: ['recipe_name', 'recipeName', 'chili_name', 'chiliName', 'dish_name', 'dishName'],
  recipeStory: ['recipe_story', 'recipeStory', 'story', 'description'],
  chiliStyle: ['chili_style', 'chiliStyle', 'style'],
  heatLevel: ['heat_level', 'heatLevel', 'heat'],
  servings: ['servings', 'yield', 'serves'],
  prepTime: ['prep_time', 'prepTime'],
  cookTime: ['cook_time', 'cookTime'],
  ingredients: ['ingredients'],
  instructions: ['instructions', 'steps'],
  hackStory: [
    'hack_story',
    'hackStory',
    'how_hack',
    'howHack',
    'hack_my_chili',
    'hackMyChili',
    'how_hacked',
    'howHacked',
    'hacked_my_chili',
    'hackedMyChili'
  ],
  servingNotes: ['serving_notes', 'servingNotes', 'pairing', 'pairings', 'garnish'],
  allergens: ['allergens', 'dietary_notes', 'dietaryNotes'],
  consentLicense: ['consent_license', 'consentLicense', 'license_consent', 'licenseConsent'],
  consentPublic: ['consent_public', 'consentPublic', 'public_consent', 'publicConsent']
};

function readField(source, key, fallback = '') {
  for (const name of FIELD_ALIASES[key] || [key]) {
    if (Object.prototype.hasOwnProperty.call(source, name) && source[name] !== undefined && source[name] !== null) {
      return source[name];
    }
  }

  return fallback;
}

function cleanText(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function splitLines(value) {
  if (Array.isArray(value)) {
    return value.flatMap(splitLines);
  }

  return cleanText(value)
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim())
    .filter(Boolean);
}

function isAffirmative(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.some(isAffirmative);
  }

  return ['1', 'true', 'yes', 'y', 'checked', 'agree', 'agreed', 'on'].includes(
    String(value === undefined || value === null ? '' : value).trim().toLowerCase()
  );
}

function slugify(value, fallback = 'untitled') {
  const slug = cleanText(value)
    .toLowerCase()
    .replace(/@/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    .slice(0, 72);

  return slug || fallback;
}

function normalizeHandle(value) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return '';
  }

  return cleaned.startsWith('@') ? cleaned : `@${cleaned}`;
}

function safeUrl(value) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return '';
  }

  try {
    const url = new URL(cleaned);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch (_error) {
    return '';
  }
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function orderedList(items) {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function addLabeledValue(lines, label, value) {
  const cleaned = cleanText(value);

  if (cleaned) {
    lines.push(`- ${label}: ${cleaned}`);
  }
}

function encodeBase64(value) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64');
  }

  return btoa(unescape(encodeURIComponent(value)));
}

function currentYear(now) {
  return String((now || new Date()).getFullYear());
}

function buildRecipe(source, config = {}, options = {}) {
  const mergedConfig = Object.assign({}, DEFAULT_CONFIG, config);
  const now = options.now || new Date();
  const contestYear = cleanText(readField(source, 'contestYear', currentYear(now)));
  const displayName = cleanText(readField(source, 'displayName'));
  const hackerHandle = normalizeHandle(readField(source, 'hackerHandle'));
  const creditUrl = safeUrl(readField(source, 'creditUrl'));
  const recipeName = cleanText(readField(source, 'recipeName'));
  const recipeStory = cleanText(readField(source, 'recipeStory'));
  const chiliStyle = cleanText(readField(source, 'chiliStyle'));
  const heatLevel = cleanText(readField(source, 'heatLevel'));
  const servings = cleanText(readField(source, 'servings'));
  const prepTime = cleanText(readField(source, 'prepTime'));
  const cookTime = cleanText(readField(source, 'cookTime'));
  const ingredients = splitLines(readField(source, 'ingredients'));
  const instructions = splitLines(readField(source, 'instructions'));
  const hackStory = cleanText(readField(source, 'hackStory'));
  const servingNotes = cleanText(readField(source, 'servingNotes'));
  const allergens = cleanText(readField(source, 'allergens'));
  const consentLicense = isAffirmative(readField(source, 'consentLicense'));
  const consentPublic = isAffirmative(readField(source, 'consentPublic'));
  const creditName = hackerHandle || displayName || 'Anonymous';
  const validationErrors = [];

  if (!recipeName) {
    validationErrors.push('Recipe name is required.');
  }

  if (!displayName && !hackerHandle) {
    validationErrors.push('Display name or hacker handle is required.');
  }

  if (!ingredients.length) {
    validationErrors.push('At least one ingredient is required.');
  }

  if (!instructions.length) {
    validationErrors.push('At least one instruction is required.');
  }

  if (!hackStory) {
    validationErrors.push('How I Hack My Chili is required.');
  }

  if (!consentLicense) {
    validationErrors.push('License consent is required.');
  }

  if (!consentPublic) {
    validationErrors.push('Public sharing consent is required.');
  }

  const title = recipeName || 'Untitled Chili';
  const recipeSlug = slugify(title, 'chili');
  const creditSlug = slugify(creditName, 'anonymous');
  const uniqueId = slugify(options.executionId || options.submissionId || String(now.getTime()), 'submission');
  const categoryDir = cleanText(mergedConfig.categoryDir || DEFAULT_CONFIG.categoryDir).toUpperCase();
  const filePath = `${categoryDir}/hack_my_chili_${contestYear}_${creditSlug}_${recipeSlug}.md`;
  const branchName = `${mergedConfig.branchPrefix}/${contestYear}/${creditSlug}_${recipeSlug}_${uniqueId}`;
  const headingCredit = creditName === 'Anonymous' ? '' : `${creditName}'s `;
  const lines = [`# ${headingCredit}${title}`, ''];

  const summary = [];
  addLabeledValue(summary, 'Contest', `Hack My Chili ${contestYear}`);
  addLabeledValue(summary, 'Credit', creditUrl ? `[${creditName}](${creditUrl})` : creditName);
  addLabeledValue(summary, 'Style', chiliStyle);
  addLabeledValue(summary, 'Heat', heatLevel);
  addLabeledValue(summary, 'Yield', servings);
  addLabeledValue(summary, 'Prep time', prepTime);
  addLabeledValue(summary, 'Cook time', cookTime);

  lines.push(...summary, '');

  if (recipeStory) {
    lines.push('## Story', '', recipeStory, '');
  }

  lines.push('## Ingredients', '', bulletList(ingredients), '', '## Instructions', '', orderedList(instructions), '', '## How I Hack My Chili', '', hackStory, '');

  if (servingNotes) {
    lines.push('## Serving Notes', '', servingNotes, '');
  }

  if (allergens) {
    lines.push('## Dietary Notes', '', allergens, '');
  }

  const markdown = `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
  const prTitle = `Add Hack My Chili ${contestYear}: ${title}`;
  const commitMessage = `Add Hack My Chili recipe: ${title}`;
  const prBody = [
    `Adds ${creditName}'s Hack My Chili ${contestYear} entry.`,
    '',
    `Generated recipe file: \`${filePath}\``,
    '',
    'Submission notes:',
    `- Style: ${chiliStyle || 'not provided'}`,
    `- Heat: ${heatLevel || 'not provided'}`,
    '- License/public-sharing consent was captured by the intake form.',
    '',
    'Maintainer checklist:',
    '- [ ] Review formatting and recipe clarity.',
    '- [ ] Confirm the public credit line is acceptable.',
    '- [ ] Add or adjust credits if needed.'
  ].join('\n');

  return {
    validationErrors,
    markdown,
    contentBase64: encodeBase64(markdown),
    filePath,
    branchName,
    commitMessage,
    prTitle,
    prBody,
    github: {
      sourceOwner: mergedConfig.sourceOwner,
      sourceRepo: mergedConfig.sourceRepo,
      targetOwner: mergedConfig.targetOwner,
      targetRepo: mergedConfig.targetRepo,
      baseBranch: mergedConfig.baseBranch
    },
    githubFileBody: {
      message: commitMessage,
      content: encodeBase64(markdown),
      branch: branchName
    },
    pullRequestBody: {
      title: prTitle,
      head: mergedConfig.sourceOwner === mergedConfig.targetOwner
        ? branchName
        : `${mergedConfig.sourceOwner}:${branchName}`,
      base: mergedConfig.baseBranch,
      body: prBody,
      maintainer_can_modify: true,
      draft: false
    },
    publicSummary: {
      contestYear,
      creditName,
      recipeName: title,
      chiliStyle,
      heatLevel,
      filePath
    }
  };
}

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  const fs = require('fs');
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error('Usage: node recipe-builder.js sample-submission.json');
    process.exit(1);
  }

  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const result = buildRecipe(input, {}, {
    now: new Date('2026-04-28T00:00:00Z'),
    executionId: 'local_test'
  });

  console.log(JSON.stringify(result, null, 2));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_CONFIG,
    buildRecipe,
    slugify,
    splitLines
  };
}
