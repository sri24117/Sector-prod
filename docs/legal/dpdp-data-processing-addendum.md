# SEctOr Data Processing Addendum (DPDP Act)

DRAFT, not legal advice, pending review by a qualified lawyer.

Version: 2026-10-24-draft. Effective date: [[HUMAN DECISION REQUIRED: effective date]]

## 1. Who this addendum is between

This addendum is between [[HUMAN DECISION REQUIRED: legal entity name, registration number and registered address]] ("SEctOr") and the organization using SEctOr ("the Organization"). It adds to the SEctOr Terms of Service.

[[HUMAN DECISION REQUIRED: how this addendum is accepted, for example signed with each organization or accepted with the Terms]]

## 2. Roles

Under the Digital Personal Data Protection Act, 2023 ("the Act"):

- the **Organization is the Data Fiduciary**. It decides why and how personal data about its beneficiaries and other people is used.
- **SEctOr is the Data Processor**. It handles that data only for the Organization and on its behalf.

This addendum covers personal data that the Organization puts into SEctOr about people other than its own account users. Data about account users and website visitors is covered by the SEctOr Privacy Policy.

[[HUMAN DECISION REQUIRED: lawyer to confirm these roles]]

## 3. What data this covers

The personal data SEctOr handles for the Organization today is:

- **consent records**: the beneficiary's name, what they agreed to (story, quote, photo, or all), a note on how consent was obtained, when it was given, and when it was revoked,
- **content drafts**: the topic and facts the Organization enters, the beneficiary names it lists, and the draft text,
- **brand voice** text,
- any personal data that appears on the Organization's own website pages that SEctOr reads for audits and full reports, including screenshots of those pages.

The people concerned are the Organization's beneficiaries and anyone else named or shown in that data.

## 4. Processing only on instructions

SEctOr will use this data only to provide the service to the Organization, as set out in the Terms, and on the Organization's documented instructions. Using the service, for example recording consent or asking for a draft, is an instruction.

SEctOr will not use this data for its own purposes, and will tell the Organization if it believes an instruction breaks the Act.

## 5. What the Organization is responsible for

The Organization is responsible for:

- having a lawful basis for the data, including valid consent from each beneficiary,
- recording consent truthfully in SEctOr, and revoking the record when consent is withdrawn,
- getting verifiable consent from a parent or guardian before adding data about a child,
- giving the people concerned the notices the Act requires,
- entering only the personal data the content needs.

## 6. Consent controls in the service

- A content draft that names a beneficiary cannot be exported unless there is an active consent record for that person, with a scope that covers the kind of content. This is checked at the moment of export, so a consent revoked after a draft was approved still blocks export.
- A person in the Organization must approve each draft before it can be exported.
- The Organization can revoke a consent record at any time in the service.
- Recording and revoking consent, and each blocked export, are written to a security log.

## 7. Security measures

SEctOr uses these measures today:

- Each organization's data is kept separate: every request is limited to the signed-in user's own organization.
- Passwords are stored only as argon2id hashes. Session cookies and password reset links are stored only as SHA-256 hashes.
- WordPress Application Passwords are encrypted with AES-256-GCM.
- Beneficiary names, and each part of a name, are replaced with placeholders before text is sent to an AI provider, and put back after.
- Requests the service makes to websites are checked so they cannot reach private or internal networks.
- Security events, such as logins, consent changes and blocked exports, are logged.
- The database is backed up every night and backups are kept for 14 days.

[[HUMAN DECISION REQUIRED: lawyer and founder to confirm whether further measures are needed, for example off-server backup copies, encryption of the whole database, or staff access rules]]

## 8. People who can see the data

Only SEctOr staff who need to, to run or support the service, can see the Organization's data. [[HUMAN DECISION REQUIRED: who those staff are, and the confidentiality terms they are bound by]]

## 9. Sub-processors

SEctOr uses these services to handle data for the Organization:

- **Hosting**: [[HUMAN DECISION REQUIRED: hosting provider name, country and region]]. Used now.
- **AI provider**: Anthropic, only when content drafting is turned on. It receives the topic, facts and brand voice with beneficiary names replaced by placeholders. Other identifying details typed into the facts are not removed automatically. [[HUMAN DECISION REQUIRED: confirm provider, region, and whether it keeps or trains on data]]
- **Google Ads**: only for Ad Grants tools, once Google grants API access. SEctOr will read compliance data from the Organization's Google Ads account. It does not send beneficiary data to Google.

Full reports use a browser run on SEctOr's own server, not a third-party service.

[[HUMAN DECISION REQUIRED: confirm this sub-processor list is complete]]

SEctOr will tell the Organization before adding or changing a sub-processor [[HUMAN DECISION REQUIRED: notice period, and whether the Organization can object]].

## 10. Where data is kept

[[HUMAN DECISION REQUIRED: hosting country and region]]. When content drafting is turned on, the text sent to the AI provider may be processed outside India.

## 11. Helping with data principal rights

If a beneficiary or other person asks the Organization to see, correct or erase their data, SEctOr will help the Organization respond. Today the Organization can see and revoke its consent records in the service. For anything else, such as deleting a consent record or a draft, the Organization writes to SEctOr and SEctOr does it [[HUMAN DECISION REQUIRED: response time]].

If SEctOr receives a request directly from a beneficiary, it will pass it to the Organization and not answer it itself.

## 12. Personal data breaches

If SEctOr becomes aware of a breach affecting the Organization's personal data, it will:

- tell the Organization [[HUMAN DECISION REQUIRED: breach notification timeline]] after becoming aware of it,
- say what happened, what data and how many people are affected, and what SEctOr is doing about it,
- give the Organization the information it needs to inform the Data Protection Board of India and the people affected.

[[HUMAN DECISION REQUIRED: breach contact at SEctOr and at the Organization]]

## 13. Deleting or returning data at the end

When the agreement ends, the Organization can ask SEctOr, within [[HUMAN DECISION REQUIRED: period]], to return its data in a readable format. After that, SEctOr will delete the Organization's data within [[HUMAN DECISION REQUIRED: deletion period]], except where the law requires it to be kept.

Data in backups is deleted as the backups expire. Backups are kept for 14 days.

The service does not yet have a button for this. SEctOr does it on written request.

## 14. Audits and information

SEctOr will give the Organization the information it reasonably needs to show that this addendum is being followed. [[HUMAN DECISION REQUIRED: whether the Organization can audit SEctOr, how often, and at whose cost]]

## 15. Law and disputes

This addendum is governed by the same law and courts as the Terms of Service.
