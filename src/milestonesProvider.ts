import * as vscode from 'vscode';
import { GitHubProvider } from './githubProvider';

export interface Milestone {
    id: number;
    number: number;
    title: string;
    description: string;
    state: 'open' | 'closed';
    open_issues: number;
    closed_issues: number;
    due_on: string | null;
    html_url: string;
}

export class MilestonesProvider implements vscode.TreeDataProvider<MilestoneItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MilestoneItem | undefined | null | void> = new vscode.EventEmitter<MilestoneItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MilestoneItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private githubProvider: GitHubProvider) {
        githubProvider.onDidAuthenticate(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MilestoneItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: MilestoneItem): Promise<MilestoneItem[]> {
        if (!this.githubProvider.isAuthenticated()) {
            const item = new MilestoneItem(
                '👋 Click here to authenticate with GitHub',
                'Required to view and manage milestones',
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
            const item = new MilestoneItem(
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

            const { data: milestones } = await octokit.issues.listMilestones({
                owner: repo.owner,
                repo: repo.repo,
                state: 'all'
            });

            if (milestones.length === 0) {
                const item = new MilestoneItem(
                    '✨ No milestones yet',
                    'Click the + button above to create your first milestone',
                    vscode.TreeItemCollapsibleState.None,
                    'empty'
                );
                item.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('notificationsInfoIcon.foreground'));
                item.tooltip = new vscode.MarkdownString(
                    '**Create Your First Milestone**\n\n' +
                    'Click the **+** button in the toolbar above to create a milestone.\n\n' +
                    'Milestones help you:\n' +
                    '- Track progress toward goals\n' +
                    '- Group related issues\n' +
                    '- Plan releases'
                );
                return [item];
            }

            return milestones.map((milestone: any) => {
                const total = milestone.open_issues + milestone.closed_issues;
                const percent = total > 0 ? Math.round((milestone.closed_issues / total) * 100) : 0;
                
                const item = new MilestoneItem(
                    milestone.title,
                    `${percent}% complete • ${milestone.open_issues} open, ${milestone.closed_issues} closed`,
                    vscode.TreeItemCollapsibleState.None,
                    milestone.state
                );
                item.milestone = milestone as Milestone;
                item.tooltip = new vscode.MarkdownString(
                    `**${milestone.title}** ${milestone.state === 'closed' ? '(Closed)' : ''}\n\n` +
                    `${milestone.description || 'No description'}\n\n` +
                    `---\n\n` +
                    `**Progress:** ${percent}% (${milestone.closed_issues}/${total})\n\n` +
                    `**Actions:**\n` +
                    `- Click to open in browser\n` +
                    `- Right-click for more options\n` +
                    `- Click edit icon to modify`
                );
                item.command = {
                    command: 'github-milestones-issues.openMilestone',
                    title: 'Open Milestone',
                    arguments: [milestone]
                };
                return item;
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to fetch milestones: ${error}`);
            return [];
        }
    }
}

export class MilestoneItem extends vscode.TreeItem {
    public milestone?: Milestone;

    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly state: string
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label} - ${this.description}`;
        this.contextValue = 'milestone';
        this.iconPath = new vscode.ThemeIcon(
            state === 'open' ? 'milestone' : 'pass',
            state === 'open' ? new vscode.ThemeColor('charts.green') : new vscode.ThemeColor('charts.gray')
        );
    }
}
