exports.run = (client, payload) => {
  const travisLabel = client.cfg.pullRequests.travisLabel();
  if (!payload.pull_request || !travisLabel) return;
  const repoOwner = payload.repository.owner_name;
  const repoName = payload.repository.name;
  const number = payload.pull_request_number;
  client.issues.getIssueLabels({
    owner: repoOwner, repo: repoName, number: number
  }).then((labels) => {
    const labelCheck = labels.data.find(label => label.name === travisLabel);
    if (!labelCheck) return;
    const state = payload.state;
    const buildURL = payload.build_url;
    let comment;
    switch (state) {
      case "passed":
        comment = `Congratulations, the Travis [builds](${buildURL}) for this pull request **${state}**!`;
        break;
      case "failed":
      case "errored": {
        const logs = buildURL ? ` Review the [build logs](${buildURL}) for more details.` : "";
        comment = `Oh no, something went wrong: the Travis builds for this pull request **${state}**!${logs}`;
        break;
      }
      default:
        comment = "(unknown state)";
        break;
    }
    client.newComment({number: number}, {name: repoName, owner: {login: repoOwner}}, comment);
  });
};

exports.events = ["travis"];
