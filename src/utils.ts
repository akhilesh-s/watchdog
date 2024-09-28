export default class Utils {
  static parseGitHubToSlackMap(envVar) {
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

  static sortByDate(messageMap: Map<number, string>) {
    const sortedMapByDays = [...messageMap].sort((a, b) => b[0] - a[0]);
    const sortedMessageMapByDays = new Map(sortedMapByDays);
    const messagesSortedByDate: string[] = [];

    sortedMessageMapByDays.forEach((value) => messagesSortedByDate.push(value));

    return messagesSortedByDate;
  }
}
