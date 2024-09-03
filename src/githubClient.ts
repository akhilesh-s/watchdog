import { Octokit } from "octokit";

class GithubClient {
  private octokit: Octokit;
  rest: any;

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
    });
  }
}

export default GithubClient;
