# SEctOr Privacy Policy

DRAFT, not legal advice, pending review by a qualified lawyer.

Version: 2026-10-24-draft. Effective date: [[HUMAN DECISION REQUIRED: effective date]]

## 1. Who we are

SEctOr is a service that helps Indian NGOs and social enterprises see and improve how visible their website is to search engines and AI assistants. It is run by [[HUMAN DECISION REQUIRED: legal entity name, registration number and registered address]].

In this policy, "SEctOr", "we" and "us" mean that entity. "You" means a person who visits our website or uses an account.

## 2. What this policy covers

This policy explains what personal data SEctOr collects about the people who visit our website and the people who hold accounts, why, and how long we keep it.

Some data an organization puts into SEctOr is about other people, for example the name of a beneficiary in a consent record or a story draft. For that data, the organization decides why and how it is used, and SEctOr handles it on the organization's instructions. That is covered by our Data Processing Addendum, not by this policy.

[[HUMAN DECISION REQUIRED: lawyer to confirm this split of roles under the Digital Personal Data Protection Act, 2023: SEctOr deciding the purpose for account and visitor data, and acting for the organization for data the organization adds about other people.]]

## 3. What we collect, and why

### When you run a free audit

- **The website address you enter.** We fetch the public pages at that address to work out the score. We do not ask for your name or email to run a free audit.
- **A record that an audit ran.** We store the event ("audit run"), the website address that was audited, and the time. We do not store your IP address, email or browser details in this record. We use it to count how many audits lead to a next step.
- If you then click a fix or connect button on the result, we store the same kind of record for that click: the event, the website address and the time.

### When you create an account

- **Your organization's name.**
- **Your name** and **your email address.** We use your email as your login and to contact you about your account.
- **Your password.** We never store your password itself. We store a one-way scrambled form of it (an argon2id hash), which cannot be turned back into the password.
- **The type of organization** you choose (NGO, CSR team, foundation or social enterprise).
- **Your organization's website address**, if you give one.
- **Registration details**, if you give them: whether you are FCRA registered, and your FCRA registration number, PAN, 12A and 80G numbers. These are self-declared. SEctOr does not verify them at signup. We use them to decide which tools to offer you, for example Google Ad Grants tools need FCRA registration.
- **That you accepted our Terms of Service and this Privacy Policy**, the time you accepted, and which version you accepted.

### When you are signed in

- **A session record.** When you log in, your browser gets a cookie that keeps you signed in for up to 30 days. We store only a scrambled form (a SHA-256 hash) of the cookie's value, its expiry time, and which account it belongs to.
- **A security log.** We record security events such as sign-ups, successful and failed logins, password reset requests, and blocked actions. Each entry holds the account and organization involved (where known), what happened, the result, and the time. It does not hold your password.
- **Audit results** for your organization's website: the address, the score, the individual checks, and when it ran.
- **Full reports**, if your organization has a paid plan. To make one, we visit up to 20 pages of your organization's own website with an automated browser, test them for speed, search and accessibility, take screenshots, and check that links (including links to your social media profiles) work. We store the report, including those screenshots, and a PDF copy. Before running a full report we ask you to prove you control the website, using a code we give you. We store that code and how it was confirmed.
- **WordPress connection details**, if you connect your WordPress site: the site address, a WordPress username, and a WordPress Application Password. We store these encrypted (AES-256-GCM). We use them only to check the login works and to talk to the SEctOr companion plugin on your site, which applies the fixes you ask for. We keep a log of each fix: what was changed, when, and the score before and after.
- **Google Ad Grants details**, if Ad Grants tools are turned on for your organization: your Google Ads customer ID and the compliance alerts we produce. Live data from Google Ads is not connected yet (see section 5).
- **Brand voice, consent records and content drafts**, if you use the content tools. See section 2: data about beneficiaries is covered by the Data Processing Addendum.

### Password resets

If you ask to reset your password, we record the request in the security log. A SEctOr staff member then sends you a reset link. The link works once, for one hour. We store only a scrambled form of it.

### Server logs

Like most websites, our servers keep technical logs of requests, which include the IP address the request came from, the page or address requested, and the time. We use these to keep the service running and secure, and to limit how often one address can make requests. [[HUMAN DECISION REQUIRED: how long server logs are kept]]

## 4. Cookies

We use one cookie, `sector_session`, which keeps you signed in. It is set only when you log in or sign up, it cannot be read by scripts on the page, and it expires after 30 days or when you log out.

We do not use advertising cookies or third-party analytics. Our fonts are served from our own servers.

## 5. Who else handles your data

We share data only with the services below, and only for the reasons given.

- **Hosting.** Our servers and database are run by [[HUMAN DECISION REQUIRED: hosting provider name]]. Data is stored in [[HUMAN DECISION REQUIRED: hosting country and region]].
- **AI writing assistant (only when turned on).** If content drafting is turned on, the topic, facts and brand voice you enter, and your organization's name, are sent to an AI provider to write the draft. Beneficiary names you list are replaced with placeholders before anything is sent, and put back after. Other details typed into the facts, like a village or an age, are not removed automatically, so please leave them out or check them. The provider the code supports today is Anthropic. [[HUMAN DECISION REQUIRED: confirm the AI provider, where it processes data, and whether it keeps or trains on what we send]]
- **Google Ads (only when available).** For organizations using Ad Grants tools, SEctOr will read compliance data from your Google Ads account. This needs Google Ads API access, which SEctOr does not have yet. Until then, no data is exchanged with Google Ads.
- **Your own website.** When we audit your site or apply a fix, we send requests to your website, and to your WordPress site if you connect it.
- **Websites you ask us to audit.** The free audit sends requests to whatever address is entered.

[[HUMAN DECISION REQUIRED: confirm this is the complete list of services that handle personal data, including any email or support tool]]

We do not sell personal data. [[HUMAN DECISION REQUIRED: confirm this commitment]]

We may share data where the law requires it.

## 6. Where your data is kept

[[HUMAN DECISION REQUIRED: hosting country and region]]. The AI provider in section 5, when turned on, may process the data sent to it outside India.

## 7. How long we keep data

The service does not yet delete any of this data automatically. The periods below need to be decided.

- Account and organization details: [[HUMAN DECISION REQUIRED: retention period after an account is closed]]
- Audit results, full reports and fix logs: [[HUMAN DECISION REQUIRED: retention period]]
- Free audit records (website address and time): [[HUMAN DECISION REQUIRED: retention period]]
- Security log: [[HUMAN DECISION REQUIRED: retention period]]
- Expired sessions and used reset links: [[HUMAN DECISION REQUIRED: retention period]]
- WordPress connection details: kept until you ask us to remove them or close your account. [[HUMAN DECISION REQUIRED: confirm]]
- Database backups are taken every night and kept for 14 days.

## 8. How we protect data

- Passwords are stored only as argon2id hashes.
- Session cookies and reset links are stored only as SHA-256 hashes.
- WordPress Application Passwords are encrypted with AES-256-GCM.
- Each organization can see only its own data.
- Beneficiary names are replaced with placeholders before text is sent to an AI provider.
- A content draft that names a beneficiary cannot be exported unless there is an active consent record for that person.

No system is perfectly secure. If a breach affects your personal data, we will tell you [[HUMAN DECISION REQUIRED: breach notification timeline and channel]].

## 9. Your rights

Under the Digital Personal Data Protection Act, 2023 you can ask us to:

- tell you what personal data we hold about you and how we use it,
- correct or complete it,
- erase it, where we no longer need it,
- name someone to act for you if you die or cannot act yourself.

You can also withdraw your consent. If you do, we stop using the data for that purpose, which may mean we cannot keep your account open.

There is no self-service button for this yet. Write to the Grievance Officer below. [[HUMAN DECISION REQUIRED: how long SEctOr takes to respond]]

## 10. Children

SEctOr is for organizations, and accounts are for adults acting for them. We do not knowingly collect data about children through our website or accounts.

## 11. Grievance Officer

If you have a question or a complaint about how we handle your data, contact:

[[HUMAN DECISION REQUIRED: Grievance Officer name, email, phone and postal address]]

If you are not satisfied with our answer, you can complain to the Data Protection Board of India.

## 12. Changes to this policy

If we change this policy, we will update the version and date at the top. If a change affects how we use your data, we will tell account holders before it takes effect [[HUMAN DECISION REQUIRED: how and how far in advance]].
