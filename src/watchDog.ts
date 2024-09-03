import GithubClient from "./githubClient";
import dayjs from "dayjs";
import axios from "axios";
import Utils from "./utils";

class WatchDog {
  private owner: string;
  private repo: string;
  private slackWebhookURL: string;
  private token: string;
  private openedFor: number;
  private octokit: any;

  constructor(
    OWNER: string,
    REPO: string,
    SLACK_WEBHOOK_URL: string,
    GH_TOKEN: string,
    DAYS: number
  ) {
    this.owner = OWNER;
    this.repo = REPO;
    this.slackWebhookURL = SLACK_WEBHOOK_URL;
    this.token = GH_TOKEN;
    this.openedFor = DAYS || 2;
  }

  private getSlackUserMention(githubUsername: string) {
    const githubToSlackMap = Utils.parseGitHubToSlackMap(
      process.env.GITHUB_TO_SLACK_MAP
    );
    const slackUserId = githubToSlackMap[githubUsername];
    return slackUserId ? `<@${slackUserId}>` : githubUsername;
  }

  // Check if required values are provided
  private checkForError() {
    if (!this.owner) {
      throw new Error("Required inputs (OWNER) are not provided.");
    } else if (!this.token) {
      throw new Error("Required inputs (GH_TOKEN) are not provided.");
    } else if (!this.repo) {
      throw new Error("Required inputs (REPO) are not provided.");
    } else if (!this.slackWebhookURL) {
      throw new Error("Required inputs (SLACK_WEBHOOK_URL) are not provided.");
    }
  }

  private getActivePRs(pullRequests: any, draft: boolean = false) {
    return pullRequests.filter((pr) => {
      const createdAt = dayjs(pr.created_at);
      return (
        dayjs().diff(createdAt, "day") > this.openedFor && pr.draft === draft
      );
    });
  }

  private async getApprovalStatus(prNumber: number) {
    try {
      const owner = this.owner;
      const repo = this.repo;
      const { data: reviews } = await this.octokit.rest.pulls.listReviews({
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

  private async generateMessage(
    prArray: any[],
    type: "Active" | "Drafts"
  ): Promise<string> {
    const messageMap = new Map();

    console.log(
      `Found ${prArray.length} ${type} PRs open for more than ${this.openedFor} days.`
    );

    for (const pr of prArray) {
      const prLink = `https://github.com/${this.owner}/${this.repo}/pull/${pr.number}`;
      const approvalStatus = await this.getApprovalStatus(pr.number);
      const slackMention = this.getSlackUserMention(pr.user.login);
      const text = `- PR #${pr.number}: ${pr.title} (opened for ${dayjs().diff(
        pr.created_at,
        "day"
      )} days) by ${slackMention} (${prLink}) ${approvalStatus}\n`;
      messageMap.set(dayjs().diff(pr.created_at, "day"), text);
    }

    const sortedByDate = Utils.sortByDate(messageMap);
    const message = `*${type} PRs opened for more than ${
      this.openedFor
    } days* \n\n${sortedByDate.join("")}`;

    return message;
  }

  async run() {
    try {
      this.checkForError();
      this.octokit = new GithubClient(this.token);
      const owner = this.owner;
      const repo = this.repo;

      const { data: pullRequests } = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state: "open",
      });

      const oldActivePRs = this.getActivePRs(pullRequests, false);
      const oldActiveDrafts = this.getActivePRs(pullRequests, true);

      const hasActivePRs = oldActivePRs.length > 0;
      const hasActiveDrafts = oldActiveDrafts.length > 0;

      if (hasActivePRs || hasActiveDrafts) {
        const messageArr: string[] = [];

        if (hasActivePRs) {
          const activePRMessage = await this.generateMessage(
            oldActivePRs,
            "Active"
          );
          messageArr.push(activePRMessage);
        }

        if (hasActiveDrafts) {
          const draftPRMessage = await this.generateMessage(
            oldActiveDrafts,
            "Drafts"
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
      throw new Error(err);
    }
  }
}

export default WatchDog;
