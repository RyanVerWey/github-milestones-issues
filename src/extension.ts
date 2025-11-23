import * as vscode from 'vscode';
import { GitHubProvider } from './githubProvider';
import { MilestonesProvider } from './milestonesProvider';
import { IssuesProvider } from './issuesProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('GitHub Milestones & Issues extension is now active!');

	// Initialize GitHub Provider
	const githubProvider = new GitHubProvider(context);

	// Initialize Tree Data Providers
	const milestonesProvider = new MilestonesProvider(githubProvider);
	const issuesProvider = new IssuesProvider(githubProvider);

	// Register Tree Views
	const milestonesTreeView = vscode.window.createTreeView('githubMilestones', {
		treeDataProvider: milestonesProvider
	});

	const issuesTreeView = vscode.window.createTreeView('githubIssues', {
		treeDataProvider: issuesProvider
	});

	// Register Commands
	context.subscriptions.push(
		// Authentication
		vscode.commands.registerCommand('github-milestones-issues.authenticate', async () => {
			await githubProvider.authenticate();
		}),

		// Refresh Commands
		vscode.commands.registerCommand('github-milestones-issues.refreshMilestones', () => {
			milestonesProvider.refresh();
		}),

		vscode.commands.registerCommand('github-milestones-issues.refreshIssues', () => {
			issuesProvider.refresh();
		}),

		// Create Commands
		vscode.commands.registerCommand('github-milestones-issues.createMilestone', async () => {
			const title = await vscode.window.showInputBox({
				prompt: 'Enter milestone title',
				placeHolder: 'v1.0.0'
			});

			if (!title) {
				return;
			}

			const description = await vscode.window.showInputBox({
				prompt: 'Enter milestone description (optional)',
				placeHolder: 'Release description...'
			});

			try {
				const octokit = githubProvider.getOctokit();
				const repo = await githubProvider.getCurrentRepository();

				if (!octokit || !repo) {
					vscode.window.showErrorMessage('Not authenticated or no repository found');
					return;
				}

				await octokit.issues.createMilestone({
					owner: repo.owner,
					repo: repo.repo,
					title,
					description: description || ''
				});

				vscode.window.showInformationMessage(`Milestone "${title}" created successfully!`);
				milestonesProvider.refresh();
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to create milestone: ${error}`);
			}
		}),

		vscode.commands.registerCommand('github-milestones-issues.createIssue', async () => {
			const title = await vscode.window.showInputBox({
				prompt: 'Enter issue title',
				placeHolder: 'Bug: Something is broken'
			});

			if (!title) {
				return;
			}

			const body = await vscode.window.showInputBox({
				prompt: 'Enter issue description (optional)',
				placeHolder: 'Describe the issue...'
			});

			try {
				const octokit = githubProvider.getOctokit();
				const repo = await githubProvider.getCurrentRepository();

				if (!octokit || !repo) {
					vscode.window.showErrorMessage('Not authenticated or no repository found');
					return;
				}

				const { data: issue } = await octokit.issues.create({
					owner: repo.owner,
					repo: repo.repo,
					title,
					body: body || ''
				});

				vscode.window.showInformationMessage(`Issue #${issue.number} created successfully!`);
				issuesProvider.refresh();
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to create issue: ${error}`);
			}
		}),

		// Open Commands
		vscode.commands.registerCommand('github-milestones-issues.openMilestone', (milestone: any) => {
			if (milestone?.html_url) {
				vscode.env.openExternal(vscode.Uri.parse(milestone.html_url));
			}
		}),

		vscode.commands.registerCommand('github-milestones-issues.openIssue', (issue: any) => {
			if (issue?.html_url) {
				vscode.env.openExternal(vscode.Uri.parse(issue.html_url));
			}
		}),

		// Tree Views
		milestonesTreeView,
		issuesTreeView
	);

	// Auto-authenticate if not already authenticated
	if (!githubProvider.isAuthenticated()) {
		vscode.window.showInformationMessage(
			'Please authenticate with GitHub to use Milestones & Issues extension',
			'Authenticate'
		).then(selection => {
			if (selection === 'Authenticate') {
				githubProvider.authenticate();
			}
		});
	}
}

export function deactivate() {}
