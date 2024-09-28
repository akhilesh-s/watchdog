import { Octokit } from "octokit";

class GithubClient {
  public _rest: Octokit;

  constructor(token: string) {
    this._rest = new Octokit({
      auth: token,
    });
  }

  public get rest(): Octokit {
    return this._rest;
  }
}

export default GithubClient;
