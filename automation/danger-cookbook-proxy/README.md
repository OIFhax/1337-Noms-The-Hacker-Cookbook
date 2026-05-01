# Danger-CookbookProxy

Danger-CookbookProxy is a general n8n intake workflow for submitting any recipe to the Hacker Cookbook. It mirrors the Danger-Chili review flow, but it lets the submitter choose the cookbook category instead of forcing every recipe into a chili cook-off path.

The intended flow is:

1. n8n hosts the public recipe submission form.
2. The Code node validates the submission and renders a Markdown recipe.
3. n8n creates a branch in your fork or writable copy of the cookbook repository.
4. n8n commits the generated recipe file under the selected category folder.
5. n8n updates `CREDITS.md` with the submitted public name and handle.
6. n8n opens a pull request against the cookbook project for human review.

## Files

- `recipe-builder.js`: Shared JavaScript formatter for local tests and the n8n Code node.
- `sample-submission.json`: Example payload you can use while testing.
- `generate-workflow.js`: Regenerates the n8n workflow export from the shared formatter.
- `danger-cookbook-proxy.workflow.json`: n8n workflow export.

## Intake Fields

Use these field names in n8n so the formatter can read the submission without extra mapping:

- `category`: Required cookbook folder. Allowed values are `APPETIZERS`, `BREAKFAST`, `COOKWARE`, `DESSERTS`, `DRINKS`, `ENTREES`, `SAUCES`, `SIDES`, and `SNACKS`.
- `display_name`: Public name for cookbook credit.
- `hacker_handle`: Optional public handle, such as `@example`.
- `credit_url`: Optional public profile URL.
- `recipe_name`: Name of the recipe.
- `recipe_description`: Optional story or description.
- `servings`: Yield.
- `prep_time`: Prep time.
- `cook_time`: Cook time.
- `difficulty`: Optional difficulty label.
- `ingredients`: One ingredient per line.
- `optional_ingredients`: Optional ingredients, one per line.
- `hardware`: Optional equipment or cookware, one item per line or comma-separated.
- `instructions`: One step per line.
- `notes`: Optional serving notes, substitutions, or tips.
- `tags`: Optional tags, comma-separated or one per line.
- `allergens`: Optional dietary or allergen notes.
- `consent_license`: Required checkbox confirming the submitter has the right to share the recipe under the cookbook license.
- `consent_public`: Required checkbox confirming the public recipe may include the chosen credit name, story, and recipe text.

Do not put email addresses, phone numbers, mailing addresses, or internal judging notes into the generated recipe Markdown. If you need contact details for operations, store them in a separate private system and keep them out of the pull request.

## GitHub Setup

Create a fine-grained GitHub token or GitHub App installation token for n8n.

Minimum permissions:

- Source repository or fork: Contents read/write.
- Source repository or fork: Metadata read.
- Target cookbook repository: Pull requests read/write.

Recommended setup:

- `sourceOwner`: `OIFhax`.
- `sourceRepo`: `1337-Noms-The-Hacker-Cookbook`.
- `targetOwner`: `pale-shadow`.
- `targetRepo`: `1337-Noms-The-Hacker-Cookbook`.
- `baseBranch`: `main`.

This writes recipe branches to the `OIFhax` fork and opens pull requests against the `pale-shadow` upstream repository.

## n8n Setup

1. Run `node automation/danger-cookbook-proxy/generate-workflow.js` after code changes.
2. Import `danger-cookbook-proxy.workflow.json` into n8n.
3. Edit the `DEFAULT_CONFIG` object in the `Build Recipe Markdown` Code node if repository owners or branches change.
4. Configure the GitHub HTTP Request nodes to use your n8n GitHub credential, or store your GitHub token in an n8n variable named `GITHUB_TOKEN`.
5. Test with the Form Trigger test URL.
6. Confirm the generated pull request includes both the recipe file and the `CREDITS.md` update.
7. Publish the workflow and use the production form URL for open submissions.

The workflow intentionally creates a pull request instead of merging automatically. That keeps cookbook maintainers in the loop for formatting, license, credit, and food-safety review.

## Local Formatter Test

Run the formatter against the sample payload:

```sh
node automation/danger-cookbook-proxy/recipe-builder.js automation/danger-cookbook-proxy/sample-submission.json
```

The output includes:

- `markdown`: The recipe body.
- `filePath`: The cookbook path that n8n will commit.
- `branchName`: The source branch for the pull request.
- `credits`: The generated `CREDITS.md` entry for the submitter.
- `githubFileBody`: JSON body for the GitHub create-or-update-file call.
- `pullRequestBody`: JSON body for the GitHub create-pull-request call.

## Image Uploads

n8n's form can collect file uploads, but this starter workflow only creates the Markdown recipe. For images, add a second path after the formatter:

1. Validate the uploaded file type and size.
2. Convert each image binary to base64.
3. Commit each image under the selected category's `images/` folder.
4. Add image links to the generated Markdown before creating the recipe file.

Keep image support behind validation. Public repository submissions should not accept arbitrary binaries without review.
