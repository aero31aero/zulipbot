const nn = require("nevernull");

exports.run = (client, body, issue, repository) => {
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const issueNumber = issue.number;
  const issueLabels = issue.labels.map(label => label.name);
  const labels = body.match(/".*?"/g).map(string => string.replace(/"/g, ""));
  const removeLabels = issueLabels.filter(label => !labels.includes(label));
  const rejected = labels.filter(label => !issueLabels.includes(label));
  client.issues.replaceAllLabels({
    owner: repoOwner, repo: repoName, number: issueNumber, labels: removeLabels
  }).then(() => {
    if (!rejected.length) return;
    const singular = rejected.length === 1;
    const rejectedLabelError = client.templates.get("labelError")
    .replace("[labels]", `Label${singular ? "" : "s"}`)
    .replace("[labelList]", `"${rejected.join("\", \"")}"`)
    .replace("[existState]", `do${singular ? "es" : ""} not exist`)
    .replace("[beState]", `w${singular === 1 ? "as" : "ere"}`)
    .replace("[action]", "removed from");
    client.newComment(issue, repository, rejectedLabelError, issue.pull_request);
  });
};

exports.aliases = nn(require("../config.js")).issues.commands.label.remove.aliases() || [];
exports.args = true;
