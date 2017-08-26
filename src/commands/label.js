const nn = require("nevernull");

exports.run = (client, body, issue, repository) => {
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const issueNumber = issue.number;
  const issueLabels = issue.labels.map(label => label.name);
  client.issues.getLabels({
    owner: repoOwner, repo: repoName, per_page: 100
  }).then((repoLabelArray) => {
    const repoLabels = repoLabelArray.data.map(label => label.name);
    const labels = body.match(/".*?"/g).map(string => string.replace(/"/g, ""));
    const alreadyAdded = labels.filter(label => issueLabels.includes(label));
    const addLabels = labels.filter(label => repoLabels.includes(label) && !issueLabels.includes(label));
    const rejected = labels.filter(label => !repoLabels.includes(label));
    client.issues.addLabels({
      owner: repoOwner, repo: repoName, number: issueNumber, labels: addLabels
    }).then(() => {
      if (rejected.length) {
        const singular = rejected.length === 1;
        const rejectedLabelError = client.templates.get("labelError")
        .replace("[labels]", `Label${singular ? "" : "s"}`)
        .replace("[labelList]", `"${rejected.join("\", \"")}"`)
        .replace("[existState]", `do${singular ? "es" : ""} not exist`)
        .replace("[beState]", `w${singular ? "as" : "ere"}`)
        .replace("[action]", "added to");
        client.newComment(issue, repository, rejectedLabelError, issue.pull_request);
      }
      if (alreadyAdded.length) {
        const singular = alreadyAdded.length === 1;
        const alreadyAddedError = client.templates.get("labelError")
        .replace("[labels]", `Label${singular ? "" : "s"}`)
        .replace("[labelList]", `"${alreadyAdded.join("\", \"")}"`)
        .replace("[existState]", `already ${singular ? "s" : ""}`)
        .replace("[beState]", `w${singular ? "as" : "ere"}`)
        .replace("[action]", "added to");
        client.newComment(issue, repository, alreadyAddedError, issue.pull_request);
      }
    });
  });
};

exports.aliases = nn(require("../config.js")).issues.commands.label.add.aliases() || [];
exports.args = true;
