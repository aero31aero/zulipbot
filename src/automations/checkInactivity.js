exports.run = (client) => {
  Promise.all(
    client.cfg.inactivity.activeRepos().reduce((all, repo) => {
      const repoOwner = repo.split("/")[0];
      const repoName = repo.split("/")[1];
      const func = client.pullRequests.getAll({
        owner: repoOwner, repo: repoName, per_page: 100
      });
      return all.concat(client.getAll(client, [], func));
    }, [])
  ).then(async(array) => {
    const pullRequests = array.reduce((a, element) => {
      return a.concat(element);
    }, []);
    await scrapeInactivePullRequests(client, pullRequests);
  });
};

async function scrapeInactivePullRequests(client, pullRequests) {
  const references = new Map();
  const ims = client.cfg.inactivity.inactivityTimeLimit() * 86400000;
  pullRequests.forEach(async(pullRequest, index, array) => {
    setTimeout(async() => {
      const time = Date.parse(pullRequest.updated_at);
      const body = pullRequest.body;
      const number = pullRequest.number;
      const author = pullRequest.user.login;
      const repoName = pullRequest.base.repo.name;
      const repoOwner = pullRequest.base.repo.owner.login;
      if (time + ims <= Date.now()) {
        const labels = await client.issues.getIssueLabels({
          owner: repoOwner, repo: repoName, number: number
        });
        const inactiveLabel = labels.data.find(l => l.name === client.cfg.inactivity.inactiveLabel());
        const reviewedLabel = labels.data.find(l => l.name === client.cfg.inactivity.pullRequests.reviewed.label());
        if (inactiveLabel || !reviewedLabel) return;
        const comment = client.templates.get("updateWarning").replace("[author]", author)
        .replace("[days]", client.cfg.inactivity.inactivityTimeLimit());
        const comments = await client.issues.getComments({
          owner: repoOwner, repo: repoName, number: number, per_page: 100
        });
        const issueComment = comments.data.slice(-1).pop();
        const lastComment = issueComment.body.includes(comment) && issueComment.user.login === client.cfg.username();
        if (reviewedLabel && !lastComment) {
          client.newComment(pullRequest, pullRequest.base.repo, comment);
        }
      }
      const commits = await client.pullRequests.getCommits({
        owner: repoOwner, repo: repoName, number: number
      });
      const refIssues = commits.data.filter((c) => {
        return c.commit.message.match(/#([0-9]+)/);
      }).map(c => c.commit.message);
      if (body.match(/#([0-9]+)/) || refIssues.length) {
        const commitRef = refIssues[0] ? refIssues[0].match(/#([0-9]+)/)[1] : null;
        const ref = commitRef || body.match(/#([0-9]+)/)[1];
        references.set(`${repoName}/${ref}`, time);
      }
      if (index !== array.length - 1) return;
      const func = client.issues.getAll({
        filter: "all", labels: client.cfg.inactivity.issues.inProgressLabel(), per_page: 100
      });
      const issues = await client.getAll(client, [], func);
      await scrapeInactiveIssues(client, references, issues);
    }, index * 500);
  });
}

async function scrapeInactiveIssues(client, references, issues) {
  const ms = client.cfg.inactivity.autoAbandonTimeLimit() * 86400000;
  const ims = client.cfg.inactivity.inactivityTimeLimit() * 86400000;
  issues.forEach(async(issue, index) => {
    setTimeout(async() => {
      const inactiveLabel = issue.labels.find(label => label.name === client.cfg.inactivity.inactiveLabel());
      if (inactiveLabel) return;
      let time = Date.parse(issue.updated_at);
      const issueNumber = issue.number;
      const repoName = issue.repository.name;
      const repoOwner = issue.repository.owner.login;
      if (time < references.get(`${repoName}/${issueNumber}`)) {
        time = references.get(`${repoName}/${issueNumber}`);
      }
      if (time + ms >= Date.now() || !client.cfg.inactivity.activeRepos().includes(`${repoOwner}/${repoName}`)) return;
      const aString = issue.assignees.map(assignee => assignee.login).join(", @");
      if (!aString) {
        const comment = "**ERROR:** This issue is in progress, but has no assignee.";
        return client.newComment(issue, issue.repository, comment);
      }
      const c = client.templates.get("inactiveWarning")
      .replace("[assignee]", aString)
      .replace("[inactive]", client.cfg.inactivity.inactivityTimeLimit())
      .replace("[abandon]", client.cfg.inactivity.autoAbandonTimeLimit())
      .replace("[username]", client.cfg.username());
      const issueComments = await client.issues.getComments({
        owner: repoOwner, repo: repoName, number: issueNumber, per_page: 100
      });
      const com = issueComments.data.slice(-1).pop();
      const labelComment = com ? com.body.includes(c) && com.user.login === client.cfg.username() : false;
      if (labelComment) {
        client.abandonIssue(client, aString.split(", @"), issue.repository, issue);
        const warning = client.templates.get("abandonWarning")
        .replace("[assignee]", aString)
        .replace("[total]", client.cfg.inactivity.autoAbandonTimeLimit() + client.cfg.inactivity.inactivityTimeLimit())
        .replace("[username]", client.cfg.username());
        client.issues.editComment({
          owner: repoOwner, repo: repoName, id: com.id, body: warning
        });
      } else if (!labelComment && time + ims <= Date.now()) {
        client.newComment(issue, issue.repository, c);
      }
    }, index * 500);
  });
}
