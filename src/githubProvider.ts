import * as vscode from 'vscode';

export class GitHubProvider {
    private octokit: any | null = null;
    private _onDidAuthenticate: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidAuthenticate: vscode.Event<void> = this._onDidAuthenticate.event;

    constructor(private context: vscode.ExtensionContext) {
        // Check for existing GitHub session on startup
        this.checkExistingSession();
    }

    private async checkExistingSession() {
        try {
            // Try to get existing session without prompting
            const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: false });
            if (session) {
                console.log('Found existing GitHub session');
                await this.initializeOctokit(session.accessToken);
                this._onDidAuthenticate.fire();
            } else {
                console.log('No existing GitHub session found');
            }
        } catch (error) {
            console.log('Error checking for existing session:', error);
        }
    }

    private async initializeOctokit(token: string) {
        const { Octokit } = await import('@octokit/rest');
        this.octokit = new Octokit({ auth: token });
        console.log('Octokit initialized');
    }

    async authenticate(): Promise<boolean> {
        try {
            console.log('Starting authentication...');
            const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: true });
            if (session) {
                console.log('Authentication successful, session obtained');
                const token = session.accessToken;
                await this.initializeOctokit(token);
                this._onDidAuthenticate.fire();
                vscode.window.showInformationMessage('Successfully authenticated with GitHub! Loading your data...');
                return true;
            }
            console.log('No session obtained');
        } catch (error) {
            console.error('Authentication error:', error);
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
        try {
            const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
            if (!gitExtension) {
                console.log('Git extension not found');
                return null;
            }

            const git = gitExtension?.getAPI(1);
            
            if (!git) {
                console.log('Git API not available');
                return null;
            }

            if (git.repositories.length === 0) {
                console.log('No git repositories found');
                return null;
            }

            const repository = git.repositories[0];
            console.log('Found repository:', repository.rootUri.fsPath);
            
            const remotes = repository.state.remotes;
            console.log('Remotes:', remotes);
            
            if (remotes.length === 0) {
                console.log('No remotes found');
                return null;
            }

            // Try to parse GitHub URL from remote
            const remote = remotes.find((r: any) => r.name === 'origin') || remotes[0];
            console.log('Using remote:', remote.name, remote.fetchUrl);
            
            const match = remote.fetchUrl?.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
            
            if (match) {
                const result = {
                    owner: match[1],
                    repo: match[2]
                };
                console.log('Detected repository:', result);
                return result;
            }

            console.log('Could not parse GitHub URL from:', remote.fetchUrl);
            return null;
        } catch (error) {
            console.error('Error getting current repository:', error);
            return null;
        }
    }
}
