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

		// Edit Issue Command
		vscode.commands.registerCommand('github-milestones-issues.editIssue', async (issueItem: any) => {
			const issue = issueItem?.issue;
			if (!issue) {
				return;
			}

			const newTitle = await vscode.window.showInputBox({
				prompt: 'Edit issue title',
				value: issue.title,
				placeHolder: 'Issue title'
			});

			if (newTitle === undefined) {
				return;
			}

			const newBody = await vscode.window.showInputBox({
				prompt: 'Edit issue description',
				value: issue.body || '',
				placeHolder: 'Issue description'
			});

			if (newBody === undefined) {
				return;
			}

			try {
				const octokit = githubProvider.getOctokit();
				const repo = await githubProvider.getCurrentRepository();

				if (!octokit || !repo) {
					vscode.window.showErrorMessage('Not authenticated or no repository found');
					return;
				}

				await octokit.issues.update({
					owner: repo.owner,
					repo: repo.repo,
					issue_number: issue.number,
					title: newTitle,
					body: newBody
				});

				vscode.window.showInformationMessage(`Issue #${issue.number} updated successfully!`);
				issuesProvider.refresh();
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to update issue: ${error}`);
			}
		}),

		// Edit Milestone Command
		vscode.commands.registerCommand('github-milestones-issues.editMilestone', async (milestoneItem: any) => {
			const milestone = milestoneItem?.milestone;
			if (!milestone) {
				return;
			}

			const newTitle = await vscode.window.showInputBox({
				prompt: 'Edit milestone title',
				value: milestone.title,
				placeHolder: 'Milestone title'
			});

			if (newTitle === undefined) {
				return;
			}

			const newDescription = await vscode.window.showInputBox({
				prompt: 'Edit milestone description',
				value: milestone.description || '',
				placeHolder: 'Milestone description'
			});

			if (newDescription === undefined) {
				return;
			}

			try {
				const octokit = githubProvider.getOctokit();
				const repo = await githubProvider.getCurrentRepository();

				if (!octokit || !repo) {
					vscode.window.showErrorMessage('Not authenticated or no repository found');
					return;
				}

				await octokit.issues.updateMilestone({
					owner: repo.owner,
					repo: repo.repo,
					milestone_number: milestone.number,
					title: newTitle,
					description: newDescription
				});

				vscode.window.showInformationMessage(`Milestone "${newTitle}" updated successfully!`);
				milestonesProvider.refresh();
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to update milestone: ${error}`);
			}
		}),

		// Assign Issue to Milestone Command
		vscode.commands.registerCommand('github-milestones-issues.assignIssueToMilestone', async (issueItem: any) => {
			const issue = issueItem?.issue;
			if (!issue) {
				return;
			}

			try {
				const octokit = githubProvider.getOctokit();
				const repo = await githubProvider.getCurrentRepository();

				if (!octokit || !repo) {
					vscode.window.showErrorMessage('Not authenticated or no repository found');
					return;
				}

				// Fetch milestones
				const { data: milestones } = await octokit.issues.listMilestones({
					owner: repo.owner,
					repo: repo.repo,
					state: 'open'
				});

				if (milestones.length === 0) {
					vscode.window.showInformationMessage('No open milestones found. Create one first!');
					return;
				}

				// Create quick pick items
				const items = [
					{ label: '$(circle-slash) Remove from milestone', milestone: null },
					...milestones.map((m: any) => ({
						label: `$(milestone) ${m.title}`,
						description: `${m.open_issues} open, ${m.closed_issues} closed`,
						milestone: m
					}))
				];

				const selected = await vscode.window.showQuickPick(items, {
					placeHolder: 'Select a milestone'
				});

				if (!selected) {
					return;
				}

				await octokit.issues.update({
					owner: repo.owner,
					repo: repo.repo,
					issue_number: issue.number,
					milestone: selected.milestone ? selected.milestone.number : null
				});

				const message = selected.milestone 
					? `Issue #${issue.number} assigned to "${selected.milestone.title}"`
					: `Issue #${issue.number} removed from milestone`;
				
				vscode.window.showInformationMessage(message);
				issuesProvider.refresh();
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to assign issue: ${error}`);
			}
		}),

		// Close Issue Command
		vscode.commands.registerCommand('github-milestones-issues.closeIssue', async (issueItem: any) => {
			const issue = issueItem?.issue;
			if (!issue) {
				return;
			}

			try {
				const octokit = githubProvider.getOctokit();
				const repo = await githubProvider.getCurrentRepository();

				if (!octokit || !repo) {
					vscode.window.showErrorMessage('Not authenticated or no repository found');
					return;
				}

				await octokit.issues.update({
					owner: repo.owner,
					repo: repo.repo,
					issue_number: issue.number,
					state: 'closed'
				});

				vscode.window.showInformationMessage(`Issue #${issue.number} closed successfully!`);
				issuesProvider.refresh();
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to close issue: ${error}`);
			}
		}),

		// Reopen Issue Command
		vscode.commands.registerCommand('github-milestones-issues.reopenIssue', async (issueItem: any) => {
			const issue = issueItem?.issue;
			if (!issue) {
				return;
			}

			try {
				const octokit = githubProvider.getOctokit();
				const repo = await githubProvider.getCurrentRepository();

				if (!octokit || !repo) {
					vscode.window.showErrorMessage('Not authenticated or no repository found');
					return;
				}

				await octokit.issues.update({
					owner: repo.owner,
					repo: repo.repo,
					issue_number: issue.number,
					state: 'open'
				});

				vscode.window.showInformationMessage(`Issue #${issue.number} reopened successfully!`);
				issuesProvider.refresh();
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to reopen issue: ${error}`);
			}
		}),

		// Close Milestone Command
		vscode.commands.registerCommand('github-milestones-issues.closeMilestone', async (milestoneItem: any) => {
			const milestone = milestoneItem?.milestone;
			if (!milestone) {
				return;
			}

			try {
				const octokit = githubProvider.getOctokit();
				const repo = await githubProvider.getCurrentRepository();

				if (!octokit || !repo) {
					vscode.window.showErrorMessage('Not authenticated or no repository found');
					return;
				}

				await octokit.issues.updateMilestone({
					owner: repo.owner,
					repo: repo.repo,
					milestone_number: milestone.number,
					state: 'closed'
				});

				vscode.window.showInformationMessage(`Milestone "${milestone.title}" closed successfully!`);
				milestonesProvider.refresh();
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to close milestone: ${error}`);
			}
		}),

		// Reopen Milestone Command
		vscode.commands.registerCommand('github-milestones-issues.reopenMilestone', async (milestoneItem: any) => {
			const milestone = milestoneItem?.milestone;
			if (!milestone) {
				return;
			}

			try {
				const octokit = githubProvider.getOctokit();
				const repo = await githubProvider.getCurrentRepository();

				if (!octokit || !repo) {
					vscode.window.showErrorMessage('Not authenticated or no repository found');
					return;
				}

				await octokit.issues.updateMilestone({
					owner: repo.owner,
					repo: repo.repo,
					milestone_number: milestone.number,
					state: 'open'
				});

				vscode.window.showInformationMessage(`Milestone "${milestone.title}" reopened successfully!`);
				milestonesProvider.refresh();
			} catch (error) {
				vscode.window.showErrorMessage(`Failed to reopen milestone: ${error}`);
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
