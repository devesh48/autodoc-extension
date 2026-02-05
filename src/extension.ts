// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  console.log("AutoDoc is now active!");

  let disposable = vscode.commands.registerCommand(
    "autodoc.generateDocs",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const codeSnippet = editor.document.getText(editor.selection);
      const fileName =
        editor.document.fileName.split(/[\\/]/).pop() || "document";
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

      if (!codeSnippet) {
        vscode.window.showWarningMessage("Highlight code to document!");
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Generating Documentation...",
        },
        async () => {
          try {
            const models = await vscode.lm.selectChatModels({
              family: "gpt-4",
            });
            const model =
              models.length > 0
                ? models[0]
                : (await vscode.lm.selectChatModels({}))[0];

            const messages = [
              vscode.LanguageModelChatMessage.User(
                `Explain this code snippet from ${fileName}. Use Markdown headers and bullet points:\n\n${codeSnippet}`,
              ),
            ];

            const request = await model.sendRequest(
              messages,
              {},
              new vscode.CancellationTokenSource().token,
            );
            let fullResponse = "";
            for await (const fragment of request.text) {
              fullResponse += fragment;
            }

            // --- THE NEW SAVING LOGIC ---
            if (workspaceFolder) {
              const docsFolderUri = vscode.Uri.joinPath(
                workspaceFolder.uri,
                "docs",
              );
              const newFileUri = vscode.Uri.joinPath(
                docsFolderUri,
                `${fileName}.docs.md`,
              );

              // 1. Create the 'docs' directory if it doesn't exist
              await vscode.workspace.fs.createDirectory(docsFolderUri);

              // 2. Write the file to disk
              const encoder = new TextEncoder();
              await vscode.workspace.fs.writeFile(
                newFileUri,
                encoder.encode(fullResponse),
              );

              // 3. Open the newly created file
              const doc = await vscode.workspace.openTextDocument(newFileUri);
              await vscode.window.showTextDocument(
                doc,
                vscode.ViewColumn.Beside,
              );

              vscode.window.showInformationMessage(
                `Saved to /docs/${fileName}.docs.md`,
              );
            } else {
              // Fallback for when no folder is open (just show unsaved)
              const doc = await vscode.workspace.openTextDocument({
                content: fullResponse,
                language: "markdown",
              });
              await vscode.window.showTextDocument(
                doc,
                vscode.ViewColumn.Beside,
              );
            }
          } catch (err: any) {
            vscode.window.showErrorMessage(`Error: ${err.message}`);
          }
        },
      );
    },
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
