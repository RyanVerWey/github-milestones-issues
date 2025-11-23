import * as vscode from 'vscode';

export class GitHubProvider {
    private octokit: any | null = null;
    private _onDidAuthenticate: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidAuthenticate: vscode.Event<void> = this._onDidAuthenticate.event;

    constructor(private context: vscode.ExtensionContext) {
        const token = this.context.globalState.get<string>('githubToken');
        if (token) {
            this.initializeOctokit(token);
        }
    }

    private async initializeOctokit(token: string) {
        const { Octokit } = await import('@octokit/rest');
        this.octokit = new Octokit({ auth: token });
    }

    async authenticate(): Promise<boolean> {
        try {
            const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
            if (session) {
                const token = session.accessToken;
                await this.context.globalState.update('githubToken', token);
                await this.initializeOctokit(token);
                this._onDidAuthenticate.fire();
                vscode.window.showInformationMessage('Successfully authenticated with GitHub!');
                return true;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to authenticate with GitHub: ${error}`);
        }
        return false;
    }

    isAuthenticated(): boolean {
        return this.octokit !== null;
    }

    getOctokit(): any | null {
        return this.octokit;
    }

    async getCurrentRepository(): Promise<{ owner: string; repo: string } | null> {
        const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
        const git = gitExtension?.getAPI(1);
        
        if (!git || git.repositories.length === 0) {
            return null;
        }

        const repository = git.repositories[0];
        const remotes = repository.state.remotes;
        
        if (remotes.length === 0) {
            return null;
        }

        // Try to parse GitHub URL from remote
        const remote = remotes.find((r: any) => r.name === 'origin') || remotes[0];
        const match = remote.fetchUrl?.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
        
        if (match) {
            return {
                owner: match[1],
                repo: match[2]
            };
        }

        return null;
    }
}
