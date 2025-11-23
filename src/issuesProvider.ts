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
            const item = new IssueItem(
                '👋 Click here to authenticate with GitHub',
                'Required to view and manage issues',
                vscode.TreeItemCollapsibleState.None,
                'action'
            );
            item.command = {
                command: 'github-milestones-issues.authenticate',
                title: 'Authenticate'
            };
            item.iconPath = new vscode.ThemeIcon('sign-in', new vscode.ThemeColor('notificationsInfoIcon.foreground'));
            return [item];
        }

        const repo = await this.githubProvider.getCurrentRepository();
        if (!repo) {
            const item = new IssueItem(
                '📂 No GitHub repository detected',
                'Open a folder with a GitHub repository',
                vscode.TreeItemCollapsibleState.None,
                'info'
            );
            item.iconPath = new vscode.ThemeIcon('folder-opened', new vscode.ThemeColor('notificationsWarningIcon.foreground'));
            item.tooltip = new vscode.MarkdownString(
                '**No Repository Found**\n\n' +
                'To use this extension:\n' +
                '1. Open a folder that contains a Git repository\n' +
                '2. Make sure the repository has a GitHub remote\n' +
                '3. The extension will automatically detect it'
            );
            return [item];
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

            const filteredIssues = issues.filter((issue: any) => !issue.pull_request);

            if (filteredIssues.length === 0) {
                const item = new IssueItem(
                    '✨ No issues yet',
                    'Click the + button above to create your first issue',
                    vscode.TreeItemCollapsibleState.None,
                    'empty'
                );
                item.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('notificationsInfoIcon.foreground'));
                item.tooltip = new vscode.MarkdownString(
                    '**Create Your First Issue**\n\n' +
                    'Click the **+** button in the toolbar above to create an issue.\n\n' +
                    'Use issues to:\n' +
                    '- Track bugs and feature requests\n' +
                    '- Collaborate with your team\n' +
                    '- Organize work into milestones'
                );
                return [item];
            }

            return filteredIssues
                .map((issue: any) => {
                    const milestoneText = issue.milestone ? ` 🎯 ${issue.milestone.title}` : '';
                    const stateIcon = issue.state === 'open' ? '●' : '✓';
                    
                    const item = new IssueItem(
                        `${stateIcon} #${issue.number} ${issue.title}`,
                        `@${issue.user?.login}${milestoneText}`,
                        vscode.TreeItemCollapsibleState.None,
                        issue.state
                    );
                    item.issue = issue as Issue;
                    item.tooltip = new vscode.MarkdownString(
                        `**Issue #${issue.number}** ${issue.state === 'closed' ? '(Closed)' : ''}\n\n` +
                        `${issue.title}\n\n` +
                        `---\n\n` +
                        `**Opened by:** @${issue.user?.login}\n\n` +
                        (issue.milestone ? `**Milestone:** ${issue.milestone.title}\n\n` : '') +
                        (issue.labels?.length > 0 ? `**Labels:** ${issue.labels.map((l: any) => l.name).join(', ')}\n\n` : '') +
                        `**Actions:**\n` +
                        `- Click to open in browser\n` +
                        `- Right-click to edit, assign, or change state\n` +
                        `- Click edit icon for quick editing`
                    );
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
