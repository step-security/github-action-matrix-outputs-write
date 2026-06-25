const core = require('@actions/core');
const yaml = require('yaml')
const {DefaultArtifactClient} = require('@actions/artifact')
const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');

async function validateSubscription() {
  let repoPrivate;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    const payload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    repoPrivate = payload?.repository?.private;
  }

  const upstream = 'gocodealone/github-action-matrix-outputs-write';
  const action = process.env.GITHUB_ACTION_REPOSITORY;
  const docsUrl = 'https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions';
  core.info('');
  core.info('\u001b[1;36mStepSecurity Maintained Action\u001b[0m');
  core.info(`Secure drop-in replacement for ${upstream}`);
  if (repoPrivate === false) core.info('\u001b[32m✓ Free for public repositories\u001b[0m');
  core.info(`\u001b[36mLearn more:\u001b[0m ${docsUrl}`);
  core.info('');
  if (repoPrivate === false) return;
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const body = { action: action || '' };
  if (serverUrl !== 'https://github.com') body.ghes_server = serverUrl;
  try {
    await axios.post(
      `https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`,
      body, { timeout: 3000 }
    );
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      core.error(`\u001b[1;31mThis action requires a StepSecurity subscription for private repositories.\u001b[0m`);
      core.error(`\u001b[31mLearn how to enable a subscription: ${docsUrl}\u001b[0m`);
      process.exit(1);
    }
    core.info('Timeout or API not reachable. Continuing to next step.');
  }
}

async function run() {
  await validateSubscription();

  try {
    const step_name = core.getInput('matrix-step-name');
    const matrix_key = core.getInput('matrix-key');
    const outputs = core.getInput('outputs');

    core.debug("step_name:")
    core.debug(step_name)

    core.debug("matrix_key:")
    core.debug(matrix_key)

    core.debug("outputs:")
    core.debug(outputs)

    function isEmptyInput(value) {
        return value === null || value.trim() === "";
    }

    if (isEmptyInput(step_name) && !isEmptyInput(matrix_key)) {
        core.setFailed("`matrix-step-name` can not be empty when `matrix-key` specified");
        return
    }

    if (!isEmptyInput(step_name) && isEmptyInput(matrix_key)) {
        core.setFailed("`matrix-key` can not be empty when `matrix-step-name` specified");
        return
    }

    const matrix_mode = !isEmptyInput(step_name) && !isEmptyInput(matrix_key)

    if (!isEmptyInput(outputs)) {
        try {
            yaml.parse(outputs)
        }
        catch (error) {
            message = `Outputs should be valid YAML
---------------------
${outputs}
---------------------
${error}`;
            core.setFailed(message);
            return
        }
    }

    const outputs_struct = !isEmptyInput(outputs) ? yaml.parse(outputs) : {}

    Object.keys(outputs_struct).forEach(function(key, index) {
        core.setOutput(key, outputs_struct[key])
    });

    core.debug("outputs_struct:")
    core.debug(outputs_struct)

    core.debug("JSON.stringify(outputs_struct):")
    core.debug(JSON.stringify(outputs_struct))

    core.setOutput('result', JSON.stringify(outputs_struct))

    if (!isEmptyInput(outputs) && matrix_mode) {
        const artifact_content = { [matrix_key]: outputs_struct }
        const filename = "./" + step_name +"-"+ matrix_key

        fs.writeFileSync(filename, JSON.stringify(artifact_content));
        const fileBuffer = fs.readFileSync(filename);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);

        const hex = hashSum.digest('hex');

        const artifactClient = new DefaultArtifactClient();
        const artifactName = step_name +"-"+ matrix_key +"-"+ hex;
        const files = [
            filename,
        ]

        const rootDirectory = '.' // Also possible to use __dirname
        const options = {
            continueOnError: false
        }

        artifactClient.uploadArtifact(artifactName, files, rootDirectory, options)
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
