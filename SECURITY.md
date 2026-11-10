# Security Policy

Interve AI handles user-provided resumes and job descriptions, interview transcripts and answers, code and whiteboard snapshots, and account/session data. Please treat potential security issues as confidential until a fix or mitigation is available.

## Reporting a vulnerability

**Do not disclose exploitable details in a public GitHub issue or discussion.**

1. If GitHub's **Security** tab offers private vulnerability reporting for this repository, use that channel.
2. If private reporting is unavailable, contact the maintainer privately through the GitHub profile and request a secure reporting channel. Do not send sensitive details through a public issue.
3. Include the affected commit or release, the security impact, minimal reproduction steps, and a proof of concept that uses synthetic data wherever possible.

Please do not include real resumes, job descriptions, interview transcripts, audio/video, personal identifiers, session tokens, API keys, database credentials, or other private user data in a report.

## In-scope examples

- Authentication, authorization, account/session isolation, or Supabase row-level security failures.
- Unauthorized access to another user's interview, transcript, report, export, or deletion workflow.
- Exposure of personal information through logs, errors, browser storage, generated reports, or public artifacts.
- Secret leakage, unsafe file handling, injection vulnerabilities, or insecure server-side tool execution.
- A bypass of documented privacy, retention, deletion, or data-access controls.

## Safe testing

- Test only systems and accounts you are authorized to use.
- Use synthetic resumes, transcripts, and datasets; never inspect or retain another user's data.
- Avoid denial-of-service testing, destructive actions, and automated scans against production deployments without prior authorization.
- Stop testing and report promptly if you encounter real personal data.

## Coordinated disclosure

The maintainer will review reports, determine affected versions and severity, and coordinate a fix or mitigation before public disclosure where practical. Please allow reasonable time for investigation and avoid publishing a proof of concept before users have a mitigation.

This policy does not change the project's documented boundary: Interve AI is an interview-practice tool, not a hiring-screening or employment-decision system.
