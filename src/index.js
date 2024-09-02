import { Octokit } from "octokit";
import dayjs from "dayjs";
import axios from "axios";

// Helper function to parse the GitHub to Slack mapping from environment variable
function parseGitHubToSlackMap(envVar) {
  const mapping = {};
  if (envVar) {
    envVar.split("\n").forEach((line) => {
      const [githubUser, slackUserId] = line
        .split(":")
        .map((item) => item.trim());
      if (githubUser && slackUserId) {
        mapping[githubUser] = slackUserId;
      }
    });
  }
  return mapping;
}

const githubToSlackMap = parseGitHubToSlackMap(process.env.GITHUB_TO_SLACK_MAP);

function getSlackUserMention(githubUsername) {
  const slackUserId = githubToSlackMap[githubUsername];
  return slackUserId ? `<@${slackUserId}>` : githubUsername; // Fallback to GitHub username if no Slack ID is found
}

function sortByDate(messageMap) {
  const sortedMapByDays = [...messageMap].sort((a, b) => b[0] - a[0]);
  const sortedMessageMapByDays = new Map(sortedMapByDays);
  const messagesSortedByDate = [];

  sortedMessageMapByDays.forEach((value) => messagesSortedByDate.push(value));

  return messagesSortedByDate;
}

async function getApprovalStatus(octokit, owner, repo, prNumber) {
  try {
    const { data: reviews } = await octokit.rest.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
    });

    // Check if there is at least one approved review
    const isApproved = reviews.some((review) => review.state === "APPROVED");

    return isApproved ? "[Approved]" : "[Not Approved]";
  } catch (error) {
    console.error(`Error fetching reviews for PR #${prNumber}:`, error);
    return "[Approval Status Unknown]";
  }
}

async function generateMessage(octokit, prArray, type, days, owner, repo) {
  const messageMap = new Map();

  console.log(
    `Found ${prArray.length} ${type} PRs open for more than ${days} days.`
  );

  for (const pr of prArray) {
    const prLink = `https://github.com/${owner}/${repo}/pull/${pr.number}`;
    const approvalStatus = await getApprovalStatus(
      octokit,
      owner,
      repo,
      pr.number
    );
    const slackMention = getSlackUserMention(pr.user.login);
    const text = `- PR #${pr.number}: ${pr.title} (opened for ${dayjs().diff(
      pr.created_at,
      "day"
    )} days) by ${slackMention} (${prLink}) ${approvalStatus}\n`;
    messageMap.set(dayjs().diff(pr.created_at, "day"), text);
  }

  const sortedByDate = sortByDate(messageMap);
  const message = `*${type} PRs opened for more than ${days} days* \n\n${sortedByDate.join(
    ""
  )}`;

  return message;
}

(async () => {
  try {
    console.log("Initializing Script...");

    const owner = process.env.OWNER;
    const repo = process.env.REPO;
    const slackWebhookURL = process.env.SLACK_WEBHOOK_URL;
    const token = process.env.GH_TOKEN;
    const openedFor = process.env.DAYS || 2;

    // Check if required values are provided
    if (!owner) {
      throw new Error("Required inputs (OWNER) are not provided.");
    } else if (!token) {
      throw new Error("Required inputs (GH_TOKEN) are not provided.");
    } else if (!repo) {
      throw new Error("Required inputs (REPO) are not provided.");
    } else if (!slackWebhookURL) {
      throw new Error("Required inputs (SLACK_WEBHOOK_URL) are not provided.");
    }

    const octokit = new Octokit({
      auth: token,
    });

    const { data: pullRequests } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "open",
    });

    const oldActivePRs = pullRequests.filter((pr) => {
      const createdAt = dayjs(pr.created_at);
      return dayjs().diff(createdAt, "day") > openedFor && !pr.draft;
    });

    const oldActiveDrafts = pullRequests.filter((pr) => {
      const createdAt = dayjs(pr.created_at);
      return dayjs().diff(createdAt, "day") > openedFor && pr.draft;
    });

    const hasActivePRs = oldActivePRs.length > 0;
    const hasActiveDrafts = oldActiveDrafts.length > 0;

    if (hasActivePRs || hasActiveDrafts) {
      const messageArr = [];

      if (hasActivePRs) {
        const activePRMessage = await generateMessage(
          octokit,
          oldActivePRs,
          "Active",
          openedFor,
          owner,
          repo
        );
        messageArr.push(activePRMessage);
      }

      if (hasActiveDrafts) {
        const draftPRMessage = await generateMessage(
          octokit,
          oldActiveDrafts,
          "Drafts",
          openedFor,
          owner,
          repo
        );
        messageArr.push(draftPRMessage);
      }

      const slackMessage = messageArr.join("\n \n");

      console.log("Slack message to be sent:", slackMessage);

      // Send message to Slack
      await axios.post(slackWebhookURL, {
        text: slackMessage,
      });
      console.log("Slack notification sent.");
    } else {
      const text = "No PRs open for more than 2 days.";
      console.log(text);
      await axios.post(slackWebhookURL, {
        text: text,
      });
    }
  } catch (err) {
    console.error("[ERROR]", err);
  }
})();
