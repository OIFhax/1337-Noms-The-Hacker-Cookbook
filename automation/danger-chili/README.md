# Danger-Chili

Danger-Chili is a starter n8n automation for turning Hack My Chili cook-off form submissions into reviewable GitHub pull requests for this cookbook.

The intended flow is:

1. n8n hosts the public intake form.
2. The Code node validates the submission and renders a Markdown recipe.
3. n8n creates a branch in your fork or writable copy of the cookbook repository.
4. n8n commits the generated recipe file under `ENTREES/`.
5. n8n opens a pull request against the cookbook project for human review.

GitHub calls these pull requests. If your team usually says merge request, treat that as the same review gate in this GitHub project.

## Files

- `recipe-builder.js`: Shared JavaScript formatter for local tests and the n8n Code node.
- `sample-submission.json`: Example payload you can use while testing.
- `danger-chili-intake.workflow.json`: n8n workflow template with the form, formatter, GitHub API calls, and PR creation step.

## Intake Fields

Use these field names in n8n so the formatter can read the submission without extra mapping:

- `contest_year`: Cook-off year, such as `2026`.
- `display_name`: Public name for cookbook credit.
- `hacker_handle`: Optional public handle, such as `@example`.
- `credit_url`: Optional public profile URL.
- `recipe_name`: Name of the chili.
- `recipe_story`: Personal story about the recipe.
- `chili_style`: Short style label, such as `Texas red`, `verde`, or `smoked beef and bean`.
- `heat_level`: Human-readable heat level.
- `servings`: Yield.
- `prep_time`: Prep time.
- `cook_time`: Cook time.
- `ingredients`: One ingredient per line.
- `instructions`: One step per line.
- `hack_story`: The required "How I Hack My Chili" answer.
- `serving_notes`: Optional toppings, serving notes, or pairings.
- `allergens`: Optional dietary or allergen notes.
- `consent_license`: Required checkbox confirming the submitter has the right to share the recipe under the cookbook license.
- `consent_public`: Required checkbox confirming the public recipe may include the chosen credit name, story, and recipe text.

Do not put email addresses, phone numbers, mailing addresses, or internal judging notes into the generated recipe Markdown. If you need contact details for event operations, store them in a separate private system and keep them out of the pull request.

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

For a fine-grained personal access token, select the `OIFhax` resource owner and the `OIFhax/1337-Noms-The-Hacker-Cookbook` repository with:

- Contents: Read and write
- Pull requests: Read and write
- Metadata: Read

If GitHub rejects the final pull request creation call because the target repository is under a different owner, keep the same token for the fork write steps and use either a GitHub App installed on both repositories or a classic PAT for the cross-repository PR step.

## n8n Setup

1. Import `danger-chili-intake.workflow.json` into n8n.
2. Edit the `DEFAULT_CONFIG` object in the `Build Recipe Markdown` Code node.
3. Store your GitHub token in an n8n variable named `GITHUB_TOKEN`, or replace the HTTP Request nodes with an n8n HTTP Header Auth credential.
4. Test with the Form Trigger test URL.
5. Confirm the generated pull request targets the right repository and branch.
6. Publish the workflow and use the production form URL for the cook-off.

The workflow intentionally creates a pull request instead of merging automatically. That keeps cookbook maintainers in the loop for formatting, license, credit, and food-safety review.

## Local Formatter Test

Run the formatter against the sample payload:

```sh
node automation/danger-chili/recipe-builder.js automation/danger-chili/sample-submission.json
```

The output includes:

- `markdown`: The recipe body.
- `filePath`: The cookbook path that n8n will commit.
- `branchName`: The source branch for the pull request.
- `githubFileBody`: JSON body for the GitHub create-or-update-file call.
- `pullRequestBody`: JSON body for the GitHub create-pull-request call.

## Image Uploads

n8n's form can collect file uploads, but this starter workflow only creates the Markdown recipe. For images, add a second path after the formatter:

1. Validate the uploaded file type and size.
2. Convert each image binary to base64.
3. Commit each image under `ENTREES/images/`.
4. Add image links to the generated Markdown before creating the recipe file.

Keep image support behind validation. Public repository submissions should not accept arbitrary binaries without review.
