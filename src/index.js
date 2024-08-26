import { Octokit } from "octokit";
import dayjs from "dayjs";
import axios from "axios";
import * as core from "@actions/core";

(() => {
  try {
    console.log("Initializing Script...");

    const owner = core.getInput("OWNER") || "";
    const repo = core.getInput("REPO") || "";
    const slackWebhookURL = core.getInput("SLACK_WEBHOOK_URL") || "";
    const token = core.getInput("GH_TOKEN") || "";

    // Check if required values are provided
    if (!owner) {
      throw new Error("Required inputs (OWNER) are not provided.");
    } else if (!token) {
      throw new Error("Required inputs (GH_TOKEN) are not provided.");
    } else if (!repo) {
      throw new Error("Required inputs (REPO) are not provided.");
    } else if (!slackWebhookURL) {
      throw new Error("Required inputs ( SLACK_WEBHOOK_URL) are not provided.");
    }

    const octokit = new Octokit({
      auth: token,
    });

    (async () => {
      const { data: pullRequests } = await octokit.rest.pulls.list({
        owner,
        repo,
        state: "open",
      });

      const oldPRs = pullRequests.filter((pr) => {
        const createdAt = dayjs(pr.created_at);
        return dayjs().diff(createdAt, "day") > 2;
      });

      if (oldPRs.length > 0) {
        console.log(`Found ${oldPRs.length} PRs open for more than 2 days.`);
        let messageArr = [];
        oldPRs.forEach((pr) => {
          const text = `- PR #${pr.number}: ${pr.title} (created on ${dayjs(
            pr.created_at
          )}) by ${pr.user.login}`;
          messageArr.push(text);
        });

        const slackMessage = messageArr.join("\n");
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
          text: slackMessage,
        });
      }
    })();
  } catch (err) {
    console.log("err", err);
  }
})();
