This is "no block no party" an EVM-based commitment system for events. See README.md about how it works.

It is a containerised projected. If you are not running in a development container, you should look at the Devcontainer configuration of the project and use Docker on the host environment to do your work inside a suitable container.

The test folder contains multiple unit test suits. Your work is not finished until it has appropriate tests. You must ensure that _all_ tests, including E2E tests, run before you consider any task complete. Do not presume that errors are transitory or unimportant. Specifically, do not ignore timeouts on E2E tests.

## E2E Test Failures Are NOT Intermittent

When E2E tests fail, **always investigate the root cause**. Do NOT dismiss failures as "intermittent", "random", or "flaky" without evidence. Test failures that occur consistently have a reason:

- **Examine screenshots in test-results/** - They show the actual UI state at failure time
- **Read the error message carefully** - Validation errors, element interception, and timeouts all have specific causes
- **Check if your changes affected test data** - For example, if you add validation that limits input to 15 characters, tests generating 20-character inputs will fail

**Lesson learned**: When implementing Twitter handle validation (max 15 characters per Twitter's rules), E2E tests failed because they generated handles like `@attend_1768335802041` (21 characters). The fix was to shorten the handle generation: `@att${String(Date.now()).slice(-6)}` (9 characters). This was NOT a flaky test - it was a consistent validation failure.

Remember these tests also need to run in the Github Actions CI environment, and you may occassionally need to use a tool called act (which you might need to install) to check this. But only if you make changes to the test environment itself.

Your work is also not complete until it lints cleanly, e.g. NO warnings NO errors, with the lint commands provided, and all errors and warnings are resolved.

You can use the folder `notes` to read and write notes to your future sessions. Please make additions here of any information you look up and find useful. Also check here before searching the web yourself. Maybe you already know!
