import * as vscode from 'vscode';
import { GitHubProvider } from './githubProvider';

export interface Issue {
    id: number;
    number: number;
    title: string;
    body: string;
    state: 'open' | 'closed';
    html_url: string;
    user: {
        login: string;
    };
    milestone?: {
        title: string;
    };
    labels: Array<{
        name: string;
        color: string;
    }>;
    created_at: string;
    updated_at: string;
}

export class IssuesProvider implements vscode.TreeDataProvider<IssueItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<IssueItem | undefined | null | void> = new vscode.EventEmitter<IssueItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<IssueItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private githubProvider: GitHubProvider) {
        githubProvider.onDidAuthenticate(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: IssueItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: IssueItem): Promise<IssueItem[]> {
        if (!this.githubProvider.isAuthenticated()) {
            return [new IssueItem('Not authenticated', '', vscode.TreeItemCollapsibleState.None, 'info')];
        }

        const repo = await this.githubProvider.getCurrentRepository();
        if (!repo) {
            return [new IssueItem('No GitHub repository detected', '', vscode.TreeItemCollapsibleState.None, 'info')];
        }

        if (element) {
            return [];
        }

        try {
            const octokit = this.githubProvider.getOctokit();
            if (!octokit) {
                return [];
            }

            const { data: issues } = await octokit.issues.listForRepo({
                owner: repo.owner,
                repo: repo.repo,
                state: 'all',
                per_page: 100
            });

            return issues
                .filter((issue: any) => !issue.pull_request) // Filter out pull requests
                .map((issue: any) => {
                    const milestoneText = issue.milestone ? ` [${issue.milestone.title}]` : '';
                    const item = new IssueItem(
                        `#${issue.number} ${issue.title}`,
                        `@${issue.user?.login}${milestoneText}`,
                        vscode.TreeItemCollapsibleState.None,
                        issue.state
                    );
                    item.issue = issue as Issue;
                    item.command = {
                        command: 'github-milestones-issues.openIssue',
                        title: 'Open Issue',
                        arguments: [issue]
                    };
                    return item;
                });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to fetch issues: ${error}`);
            return [];
        }
    }
}

export class IssueItem extends vscode.TreeItem {
    public issue?: Issue;

    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly state: string
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label} - ${this.description}`;
        this.contextValue = 'issue';
        this.iconPath = new vscode.ThemeIcon(
            state === 'open' ? 'issues' : 'issue-closed',
            state === 'open' ? new vscode.ThemeColor('charts.green') : new vscode.ThemeColor('charts.purple')
        );
    }
}
