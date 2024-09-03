import WatchDog from "./watchDog";

(async () => {
  const owner = process.env.OWNER || "";
  const repo = process.env.REPO || "";
  const slackWebhookURL = process.env.SLACK_WEBHOOK_URL || "";
  const token = process.env.GH_TOKEN || "";
  const openedFor = process.env.DAYS || 2;

  try {
    const watchDogObj = new WatchDog(
      owner,
      repo,
      slackWebhookURL,
      token,
      openedFor as number
    );

    await watchDogObj.run();
  } catch (err) {
    console.error("[ERROR]", err);
  }
})();
