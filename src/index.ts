import WatchDog from "./watchDog";

(async () => {
  const owner = process.env.OWNER || "";
  const repos = process.env.REPO ? JSON.parse(process.env.REPO) : [];
  const slackWebhookURL = process.env.SLACK_WEBHOOK_URL || "";
  const token = process.env.GH_TOKEN || "";
  const openedFor = process.env.DAYS || 2;

  try {
    for (const repo of repos) {
      // Loop through each repo
      const watchDogObj = new WatchDog(
        owner,
        repo,
        slackWebhookURL,
        token,
        Number(openedFor)
      );
      await watchDogObj.run();
    }
  } catch (err) {
    console.error("[ERROR]", err);
  }
})();
