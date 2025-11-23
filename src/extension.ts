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

	// Create Status Bar Item
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.command = 'github-milestones-issues.showCommands';
	statusBarItem.text = '$(github) GitHub Issues';
	statusBarItem.tooltip = 'Click for GitHub Milestones & Issues commands';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	// Update status bar based on authentication
	const updateStatusBar = async () => {
		if (githubProvider.isAuthenticated()) {
			const repo = await githubProvider.getCurrentRepository();
			if (repo) {
				statusBarItem.text = `$(github) ${repo.owner}/${repo.repo}`;
				statusBarItem.tooltip = `Connected to ${repo.owner}/${repo.repo}\nClick for commands`;
			} else {
				statusBarItem.text = '$(github) No repo';
				statusBarItem.tooltip = 'No GitHub repository detected\nClick for commands';
			}
		} else {
			statusBarItem.text = '$(github) Not authenticated';
			statusBarItem.tooltip = 'Click to authenticate with GitHub';
		}
	};

	githubProvider.onDidAuthenticate(() => {
		updateStatusBar();
	});
	updateStatusBar();

	// Register Tree Views
	const milestonesTreeView = vscode.window.createTreeView('githubMilestones', {
		treeDataProvider: milestonesProvider
	});

	const issuesTreeView = vscode.window.createTreeView('githubIssues', {
		treeDataProvider: issuesProvider
	});

	// Register Commands
	context.subscriptions.push(
		// Show Commands Quick Pick
		vscode.commands.registerCommand('github-milestones-issues.showCommands', async () => {
			const items: vscode.QuickPickItem[] = [];
			
			if (!githubProvider.isAuthenticated()) {
				items.push({
					label: '$(sign-in) Authenticate with GitHub',
					description: 'Connect your GitHub account',
					detail: 'Required to view and manage milestones and issues'
				});
			} else {
				const repo = await githubProvider.getCurrentRepository();
				if (repo) {
					items.push({
						label: `$(repo) Current: ${repo.owner}/${repo.repo}`,
						description: 'Repository detected'
					});
				}
				
				items.push(
					{
						label: '$(add) Create New Issue',
						description: 'Add a new issue to this repository'
					},
					{
						label: '$(milestone) Create New Milestone',
						description: 'Add a new milestone to this repository'
					},
					{
						label: '$(refresh) Refresh Views',
						description: 'Update milestones and issues from GitHub'
					},
					{
						label: '$(debug) Debug Info',
						description: 'Show connection and repository information'
					},
					{
						label: '$(sign-out) Sign Out',
						description: 'Disconnect from GitHub'
					}
				);
			}

			const selected = await vscode.window.showQuickPick(items, {
				placeHolder: 'What would you like to do?'
			});

			if (selected) {
				if (selected.label.includes('Authenticate')) {
					vscode.commands.executeCommand('github-milestones-issues.authenticate');
				} else if (selected.label.includes('Create New Issue')) {
					vscode.commands.executeCommand('github-milestones-issues.createIssue');
				} else if (selected.label.includes('Create New Milestone')) {
					vscode.commands.executeCommand('github-milestones-issues.createMilestone');
				} else if (selected.label.includes('Refresh')) {
					milestonesProvider.refresh();
					issuesProvider.refresh();
					vscode.window.showInformationMessage('Views refreshed!');
				} else if (selected.label.includes('Debug Info')) {
					const isAuth = githubProvider.isAuthenticated();
					const repo = await githubProvider.getCurrentRepository();
					const octokit = githubProvider.getOctokit();
					
					let message = `**Authentication:** ${isAuth ? '✓ Connected' : '✗ Not connected'}\n\n`;
					message += `**Repository:** ${repo ? `${repo.owner}/${repo.repo}` : 'Not detected'}\n\n`;
					message += `**Octokit:** ${octokit ? '✓ Initialized' : '✗ Not initialized'}\n\n`;
					
					if (repo && octokit) {
						try {
							const { data: milestones } = await octokit.issues.listMilestones({
								owner: repo.owner,
								repo: repo.repo,
								state: 'all'
							});
							const { data: issues } = await octokit.issues.listForRepo({
								owner: repo.owner,
								repo: repo.repo,
								state: 'all',
								per_page: 100
							});
							message += `**Milestones:** ${milestones.length} found\n\n`;
							message += `**Issues:** ${issues.filter((i: any) => !i.pull_request).length} found\n\n`;
						} catch (error) {
							message += `**API Error:** ${error}\n\n`;
						}
					}
					
					const panel = vscode.window.createWebviewPanel(
						'debugInfo',
						'GitHub Extension Debug Info',
						vscode.ViewColumn.One,
						{}
					);
					panel.webview.html = `
						<!DOCTYPE html>
						<html>
						<body style="padding: 20px; font-family: system-ui;">
							<h1>Debug Information</h1>
							<pre style="background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 5px;">${message}</pre>
							<p>Check the Output panel (View → Output) and select "Log (Window)" for more details.</p>
						</body>
						</html>
					`;
				}
			}
		}),

		// Authentication
		vscode.commands.registerCommand('github-milestones-issues.authenticate', async () => {
			const success = await githubProvider.authenticate();
			if (success) {
				// Immediately refresh both views
				milestonesProvider.refresh();
				issuesProvider.refresh();
				
				// Open the sidebar to show the data
				vscode.commands.executeCommand('workbench.view.extension.github-milestones-issues');
				
				// Check if we have data to show
				setTimeout(async () => {
					const repo = await githubProvider.getCurrentRepository();
					if (repo) {
						vscode.window.showInformationMessage(
							`✓ Loaded milestones and issues from ${repo.owner}/${repo.repo}`
						);
					}
				}, 1000);
			}
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
		// Show welcome message with clear instructions
		vscode.window.showInformationMessage(
			'Welcome to GitHub Milestones & Issues! 👋',
			'Get Started',
			'Later'
		).then(selection => {
			if (selection === 'Get Started') {
				vscode.window.showInformationMessage(
					'First, let\'s connect to GitHub. Click Authenticate below.',
					'Authenticate'
				).then(authChoice => {
					if (authChoice === 'Authenticate') {
						githubProvider.authenticate();
					}
				});
			}
		});
	} else {
		// Show quick tip for existing users
		githubProvider.getCurrentRepository().then(repo => {
			if (repo) {
				vscode.window.showInformationMessage(
					`Connected to ${repo.owner}/${repo.repo} ✓`,
					'View Issues',
					'View Milestones'
				).then(selection => {
					if (selection === 'View Issues' || selection === 'View Milestones') {
						vscode.commands.executeCommand('workbench.view.extension.github-milestones-issues');
					}
				});
			}
		});
	}
}

export function deactivate() {}
