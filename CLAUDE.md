This is "no block no party" an EVM-based commitment system for events. See README.md about how it works.

It is a containerised projected. If you are not running in a development container, you should look at the Devcontainer configuration of the project and use Docker on the host environment to do your work inside a suitable container.

The test folder contains multiple unit test suits. Your work is not finished until it has appropriate tests. You must ensure that _all_ tests, including E2E tests, run before you consider any task complete. Do not presume that errors are transitory or unimportant.

Remember these tests also need to run in the Github Actions CI environment, and you may occassionally need to use a tool called act (which you might need to install) to check this. But only if you make changes to the test environment itself.

Your work is also not complete until it lints cleanly with the lint commands provided, and all errors and warnings are resolved.

You can use the folder `notes` to read and write notes to your future sessions. Please make additions here of any information you look up and find useful. Also check here before searching the web yourself. Maybe you already know!
