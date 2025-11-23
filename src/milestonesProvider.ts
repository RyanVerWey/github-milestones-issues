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
            return [new MilestoneItem('Not authenticated', '', vscode.TreeItemCollapsibleState.None, 'info')];
        }

        const repo = await this.githubProvider.getCurrentRepository();
        if (!repo) {
            return [new MilestoneItem('No GitHub repository detected', '', vscode.TreeItemCollapsibleState.None, 'info')];
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

            return milestones.map((milestone: any) => {
                const item = new MilestoneItem(
                    milestone.title,
                    `${milestone.open_issues} open, ${milestone.closed_issues} closed`,
                    vscode.TreeItemCollapsibleState.None,
                    milestone.state
                );
                item.milestone = milestone as Milestone;
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
