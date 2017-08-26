const nn = require("nevernull");

exports.run = (client, comment, issue, repository) => {
  const commenter = comment.user.login;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  if (issue.assignees && issue.assignees.find(assignee => assignee.login === commenter)) {
    return client.newComment(issue, repository, "**ERROR:** You have already claimed this issue.");
  }
  client.repos.checkCollaborator({
    owner: repoOwner, repo: repoName, username: commenter
  }).then((response) => {
    if (response.meta.status !== "204 No Content") {
      return client.newComment(issue, repository, "**ERROR:** Unexpected response from GitHub API.");
    }
    exports.claimIssue(client, comment, issue, repository);
  }, (response) => {
    if (response.headers.status !== "404 Not Found") {
      return client.newComment(issue, repository, "**ERROR:** Unexpected response from GitHub API.");
    }
    exports.addCollaborator(client, comment, issue, repository);
  });
};

exports.addCollaborator = (client, comment, issue, repository) => {
  const commenter = comment.user.login;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  const collab = client.cfg.issues.commands.assign.claim.permission();
  if (!collab) {
    const comment = "**ERROR:** `claim.permission` wasn't specified in `src/config.js`.";
    return client.newComment(issue, repository, comment);
  }
  client.repos.addCollaborator({
    owner: repoOwner, repo: repoName, username: commenter, permission: collab
  }).then(() => exports.claimIssue(client, comment, issue, repository, true));
};

exports.claimIssue = (client, comment, issue, repository, newContrib) => {
  const commenter = comment.user.login;
  const issueNumber = issue.number;
  const repoName = repository.name;
  const repoOwner = repository.owner.login;
  client.issues.addAssigneesToIssue({
    owner: repoOwner, repo: repoName, number: issueNumber, assignees: [commenter]
  }).then((response) => {
    if (!response.data.assignees) {
      return client.newComment(issue, repository, "**ERROR:** Issue claiming failed (no assignee was added).");
    }
    if (!newContrib) return;
    client.newComment(issue, repository, client.templates.get("newContributor").replace("[commenter]", commenter));
  });
};

exports.aliases = nn(require("../config.js")).issues.commands.assign.claim.aliases() || [];
exports.args = false;
