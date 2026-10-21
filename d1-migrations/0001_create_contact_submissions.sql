-- Contact form submissions from the homepage (POST /api/contact)
CREATE TABLE contact_submissions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    NOT NULL,
    phone      TEXT,
    message    TEXT    NOT NULL,
    country    TEXT,
    user_agent TEXT,
    email_sent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_contact_submissions_created_at ON contact_submissions (created_at);
