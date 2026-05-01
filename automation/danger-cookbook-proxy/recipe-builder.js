'use strict';

const DEFAULT_CONFIG = {
  sourceOwner: 'OIFhax',
  sourceRepo: '1337-Noms-The-Hacker-Cookbook',
  targetOwner: 'pale-shadow',
  targetRepo: '1337-Noms-The-Hacker-Cookbook',
  baseBranch: 'main',
  branchPrefix: 'danger-cookbook-proxy',
  allowedCategories: [
    'APPETIZERS',
    'BREAKFAST',
    'COOKWARE',
    'DESSERTS',
    'DRINKS',
    'ENTREES',
    'SAUCES',
    'SIDES',
    'SNACKS'
  ]
};

const FIELD_ALIASES = {
  category: ['category', 'categoryDir', 'category_dir', 'Recipe Category', 'Cookbook Category', 'section'],
  displayName: ['display_name', 'displayName', 'Public Display Name', 'name', 'chef_name', 'chefName'],
  hackerHandle: ['hacker_handle', 'hackerHandle', 'Hacker Handle', 'handle', 'credit_handle', 'creditHandle'],
  creditUrl: ['credit_url', 'creditUrl', 'Public Credit URL', 'profile_url', 'profileUrl'],
  recipeName: ['recipe_name', 'recipeName', 'Recipe Name', 'dish_name', 'dishName', 'title'],
  recipeDescription: ['recipe_description', 'recipeDescription', 'Recipe Description', 'Recipe Story', 'story', 'description'],
  servings: ['servings', 'Servings', 'yield', 'Yield', 'serves'],
  prepTime: ['prep_time', 'prepTime', 'Prep Time'],
  cookTime: ['cook_time', 'cookTime', 'Cook Time'],
  difficulty: ['difficulty', 'Difficulty'],
  ingredients: ['ingredients', 'Ingredients'],
  optionalIngredients: ['optional_ingredients', 'optionalIngredients', 'Optional Ingredients', 'optional'],
  instructions: ['instructions', 'Instructions', 'steps'],
  notes: ['notes', 'Notes', 'serving_notes', 'servingNotes', 'Serving Notes', 'pairing', 'pairings', 'garnish'],
  hardware: ['hardware', 'Hardware', 'equipment', 'Equipment', 'cookware'],
  tags: ['tags', 'Tags'],
  allergens: ['allergens', 'Allergens or Dietary Notes', 'dietary_notes', 'dietaryNotes'],
  consentLicense: [
    'consent_license',
    'consentLicense',
    'I have the right to share this recipe under the cookbook license',
    'license_consent',
    'licenseConsent'
  ],
  consentPublic: [
    'consent_public',
    'consentPublic',
    'I understand the chosen credit name, story, and recipe text will be public',
    'public_consent',
    'publicConsent'
  ]
};

const FORM_PAYLOAD_KEYS = [
  'body',
  'data',
  'fields',
  'formData',
  'form_data',
  'payload',
  'submission',
  'submissionData',
  'submittedData'
];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function cleanInlineText(value) {
  return cleanText(value).replace(/\s+/g, ' ');
}

function isMarkdownListLine(line) {
  return /^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
}

function isBlankLine(line) {
  return /^\s*$/.test(line);
}

function formatMarkdownBlock(value) {
  const lines = cleanText(value).split('\n');
  const formatted = [];

  for (const line of lines) {
    const previous = formatted[formatted.length - 1];
    const startsList = isMarkdownListLine(line);
    const previousIsList = previous !== undefined && isMarkdownListLine(previous);

    if (startsList && previous !== undefined && !isBlankLine(previous) && !previousIsList) {
      formatted.push('');
    }

    if (!startsList && !isBlankLine(line) && previousIsList) {
      formatted.push('');
    }

    formatted.push(line);
  }

  return formatted.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizedKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function collectSourceCandidates(source, seen = new Set()) {
  if (!isPlainObject(source) || seen.has(source)) {
    return [];
  }

  seen.add(source);

  const candidates = [source];

  for (const key of FORM_PAYLOAD_KEYS) {
    if (isPlainObject(source[key])) {
      candidates.push(...collectSourceCandidates(source[key], seen));
    }
  }

  return candidates;
}

function findField(source, names) {
  for (const candidate of collectSourceCandidates(source)) {
    for (const name of names) {
      if (Object.prototype.hasOwnProperty.call(candidate, name) && candidate[name] !== undefined && candidate[name] !== null) {
        return candidate[name];
      }
    }

    const normalizedLookup = {};
    for (const [key, value] of Object.entries(candidate)) {
      normalizedLookup[normalizedKey(key)] = value;
    }

    for (const name of names) {
      const key = normalizedKey(name);
      if (Object.prototype.hasOwnProperty.call(normalizedLookup, key) && normalizedLookup[key] !== undefined && normalizedLookup[key] !== null) {
        return normalizedLookup[key];
      }
    }
  }

  return undefined;
}

function readField(source, key, fallback = '') {
  const value = findField(source, FIELD_ALIASES[key] || [key]);

  return value === undefined ? fallback : value;
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

function splitDelimited(value) {
  if (Array.isArray(value)) {
    return value.flatMap(splitDelimited);
  }

  return cleanText(value)
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAffirmative(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.length > 0 && !value.every((item) => ['0', 'false', 'no', 'n', 'off', 'unchecked'].includes(
      String(item === undefined || item === null ? '' : item).trim().toLowerCase()
    ));
  }

  const cleaned = String(value === undefined || value === null ? '' : value).trim().toLowerCase();

  if (!cleaned || ['0', 'false', 'no', 'n', 'off', 'unchecked'].includes(cleaned)) {
    return false;
  }

  return true;
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
  const cleaned = cleanInlineText(value);

  if (!cleaned) {
    return '';
  }

  return cleaned.startsWith('@') ? cleaned : `@${cleaned}`;
}

function safeUrl(value) {
  const cleaned = cleanInlineText(value);

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

function normalizeCategory(value, allowedCategories = DEFAULT_CONFIG.allowedCategories) {
  const cleaned = cleanInlineText(value);
  const normalized = normalizedKey(cleaned);

  if (!normalized) {
    return '';
  }

  return allowedCategories.find((category) => normalizedKey(category) === normalized) || '';
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function orderedList(items) {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function addLabeledValue(lines, label, value) {
  const cleaned = cleanInlineText(value);

  if (cleaned) {
    lines.push(`- ${label}: ${cleaned}`);
  }
}

function escapeMarkdownLinkLabel(value) {
  return cleanInlineText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function formatCreditsContributor(displayName, hackerHandle, creditUrl) {
  const contributor = hackerHandle && displayName
    ? `${hackerHandle} (${displayName})`
    : hackerHandle || displayName || 'Anonymous';
  const cleaned = cleanInlineText(contributor);

  return creditUrl ? `[${escapeMarkdownLinkLabel(cleaned)}](${creditUrl})` : cleaned;
}

function encodeBase64(value) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64');
  }

  return btoa(unescape(encodeURIComponent(value)));
}

function buildRecipe(source, config = {}, options = {}) {
  const mergedConfig = Object.assign({}, DEFAULT_CONFIG, config);
  const allowedCategories = mergedConfig.allowedCategories || DEFAULT_CONFIG.allowedCategories;
  const now = options.now || new Date();
  const categoryInput = readField(source, 'category');
  const categoryDir = normalizeCategory(categoryInput, allowedCategories);
  const displayName = cleanInlineText(readField(source, 'displayName'));
  const hackerHandle = normalizeHandle(readField(source, 'hackerHandle'));
  const creditUrl = safeUrl(readField(source, 'creditUrl'));
  const recipeName = cleanInlineText(readField(source, 'recipeName'));
  const recipeDescription = cleanText(readField(source, 'recipeDescription'));
  const servings = cleanInlineText(readField(source, 'servings'));
  const prepTime = cleanInlineText(readField(source, 'prepTime'));
  const cookTime = cleanInlineText(readField(source, 'cookTime'));
  const difficulty = cleanInlineText(readField(source, 'difficulty'));
  const ingredients = splitLines(readField(source, 'ingredients'));
  const optionalIngredients = splitLines(readField(source, 'optionalIngredients'));
  const instructions = splitLines(readField(source, 'instructions'));
  const notes = cleanText(readField(source, 'notes'));
  const hardware = splitDelimited(readField(source, 'hardware'));
  const tags = splitDelimited(readField(source, 'tags'));
  const allergens = cleanText(readField(source, 'allergens'));
  const consentLicense = isAffirmative(readField(source, 'consentLicense'));
  const consentPublic = isAffirmative(readField(source, 'consentPublic'));
  const creditName = hackerHandle || displayName || 'Anonymous';
  const validationErrors = [];

  if (!categoryDir) {
    validationErrors.push(`Recipe category is required and must be one of: ${allowedCategories.join(', ')}.`);
  }

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

  if (!consentLicense) {
    validationErrors.push('License consent is required.');
  }

  if (!consentPublic) {
    validationErrors.push('Public sharing consent is required.');
  }

  const title = recipeName || 'Untitled Recipe';
  const recipeSlug = slugify(title, 'recipe');
  const creditSlug = slugify(creditName, 'anonymous');
  const uniqueId = slugify(options.executionId || options.submissionId || String(now.getTime()), 'submission');
  const filePath = `${categoryDir || 'ENTREES'}/${creditSlug}_${recipeSlug}.md`;
  const branchName = `${mergedConfig.branchPrefix}/${categoryDir || 'recipe'}/${creditSlug}_${recipeSlug}_${uniqueId}`;
  const headingCredit = creditName === 'Anonymous' ? '' : `${creditName}'s `;
  const lines = [`# ${headingCredit}${title}`, ''];

  if (recipeDescription) {
    lines.push(formatMarkdownBlock(recipeDescription), '');
  }

  const summary = [];
  addLabeledValue(summary, 'Category', categoryDir);
  addLabeledValue(summary, 'Credit', creditUrl ? `[${creditName}](${creditUrl})` : creditName);
  addLabeledValue(summary, 'Yield', servings);
  addLabeledValue(summary, 'Prep time', prepTime);
  addLabeledValue(summary, 'Cook time', cookTime);
  addLabeledValue(summary, 'Difficulty', difficulty);

  if (summary.length) {
    lines.push(...summary, '');
  }

  lines.push('## Ingredients', '', bulletList(ingredients), '');

  if (optionalIngredients.length) {
    lines.push('## Optional', '', bulletList(optionalIngredients), '');
  }

  if (hardware.length) {
    lines.push('## Hardware', '', bulletList(hardware), '');
  }

  lines.push('## Instructions', '', orderedList(instructions), '');

  if (notes) {
    lines.push('## Notes', '', formatMarkdownBlock(notes), '');
  }

  if (allergens) {
    lines.push('## Dietary Notes', '', formatMarkdownBlock(allergens), '');
  }

  if (tags.length) {
    lines.push('## Tags', '', bulletList(tags), '');
  }

  const markdown = `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
  const creditsContributor = formatCreditsContributor(displayName, hackerHandle, creditUrl);
  const creditsEntry = `- ${creditsContributor} - ${cleanInlineText(title)}`;
  const commitMessage = `Add recipe: ${title}`;
  const creditsCommitMessage = `Update credits for recipe: ${title}`;
  const prTitle = `Add recipe: ${title}`;
  const prBody = [
    `Adds ${creditName}'s recipe, ${title}.`,
    '',
    `Generated recipe file: \`${filePath}\``,
    'Updates `CREDITS.md` with the submitted public name and handle.',
    '',
    'Submission notes:',
    `- Category: ${categoryDir || 'not provided'}`,
    `- Tags: ${tags.length ? tags.join(', ') : 'not provided'}`,
    '- License/public-sharing consent was captured by the intake form.',
    '',
    'Maintainer checklist:',
    '- [ ] Review formatting and recipe clarity.',
    '- [ ] Confirm category placement.',
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
    creditsCommitMessage,
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
    credits: {
      path: 'CREDITS.md',
      entry: creditsEntry,
      contributorName: displayName,
      contributorHandle: hackerHandle,
      contributorDisplay: creditsContributor,
      recipeName: title
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
      categoryDir,
      creditName,
      recipeName: title,
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
    now: new Date('2026-04-30T00:00:00Z'),
    executionId: 'local_test'
  });

  console.log(JSON.stringify(result, null, 2));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_CONFIG,
    buildRecipe,
    formatMarkdownBlock,
    formatCreditsContributor,
    normalizeCategory,
    readField,
    slugify,
    splitLines
  };
}
