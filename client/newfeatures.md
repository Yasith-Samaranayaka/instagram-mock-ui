# Instagram Mock UI - New Features To Implement

---

## Client Approval Workflow (New)

This feature captures client feedback (email, likes, comments) against each post or the entire grid, allows clients to review their comments before sending, and records approvals for admin visibility.

### Goals
- Capture client email when they open the shared link and tie feedback to that identity.
- Allow per-post likes (approval) and comments, plus a grid-level comment.
- Provide a review panel for clients to confirm comments before submitting.
- Record the submission as an approval package tied to the feed.
- Show admin-side indicators for liked posts (green tick) and posts with comments (comment badge).

### Data Storage (JSON Files)
- `Data/client_emails.json`: Log of client emails per feed.
- `Data/client_feedback.json`: Likes and comments collected per feed/post.
- `Data/approvals.json`: Recorded approval submissions per feed.

### Data Models
Client Email Log (append-only):
```javascript
// Data/client_emails.json
[
  {
    feedId: 1702000000000,
    email: "client@example.com",
    timestamp: 1702001234567
  }
]
```

Client Feedback (draft state prior to send):
```javascript
// Data/client_feedback.json
[
  {
    feedId: 1702000000000,
    clientEmail: "client@example.com",
    gridComment: "Overall looks good, please adjust spacing.",
    posts: [
      {
        postId: "1702000000001",
        liked: true,
        comments: [
          {
            id: "1702000009001",
            text: "Increase brightness",
            timestamp: 1702000009001
          }
        ]
      },
      {
        postId: "1702000000002",
        liked: false,
        comments: []
      }
    ],
    lastUpdated: 1702000009999
  }
]
```

Approval Submissions (immutable record created when client presses Send):
```javascript
// Data/approvals.json
[
  {
    approvalId: 1702000012345,
    feedId: 1702000000000,
    clientEmail: "client@example.com",
    payload: {
      gridComment: "Final OK.",
      posts: [
        { postId: "1702000000001", liked: true, comments: ["Increase brightness"] },
        { postId: "1702000000002", liked: false, comments: [] }
      ]
    },
    submittedAt: 1702000012345
  }
]
```

### Backend - New API Endpoints

Email Log:
- `POST /api/client-email` → `{ feedId, email }` stores an entry in `client_emails.json`.
- `GET /api/client-email/:feedId` → returns emails for a feed.

Feedback (Draft Likes/Comments):
- `GET /api/feedback/:feedId?email={email}` → fetch current draft.
- `POST /api/feedback` → upsert draft: `{ feedId, clientEmail, gridComment, posts[] }` saved to `client_feedback.json`.
- `PATCH /api/feedback/like` → `{ feedId, clientEmail, postId, liked }` toggles like.
- `PATCH /api/feedback/comment` → `{ feedId, clientEmail, postId, text }` adds a comment.
- `DELETE /api/feedback/comment` → `{ feedId, clientEmail, postId, commentId }` removes a comment.

Approval Submission:
- `POST /api/approvals` → `{ feedId, clientEmail }` converts the current draft to a recorded approval in `approvals.json` and returns `approvalId`.
- `GET /api/approvals/:feedId` → list approval submissions for that feed.

### Frontend - Client View (Grid & Single)

Entry & Email Capture:
- On initial load of `client.html` or `single-client.html`, prompt the client to enter their email using a modal that matches the 1:1 `UI Ref` design.
- Store email locally (session/localStorage) and send to `POST /api/client-email`.

Interactions:
- Per-post like (heart icon) toggles liked state and calls `PATCH /api/feedback/like`.
- Per-post comments: open the comment input modal, add/remove comments via `PATCH`/`DELETE` feedback endpoints.
- Grid-level comment: a top-level input or modal to attach an overall note.

Review Panel:
- A dedicated panel (drawer/modal) allows the client to preview all draft comments and likes before sending. UI must match `UI Ref` styling and layout exactly.

Send Button:
- A visible "Send" button in both grid and single client views.
- On click, submits the current draft (`POST /api/approvals`) and shows a success state.

### Frontend - Admin/User Area

Existing Grid List:
- When viewing an existing grid (feed) that has client approvals, show indicators per post:
  - Green tick icon for `liked: true` posts.
  - Comment badge count for posts with comments.
- Provide a panel to view approval payloads, grouped by `approvalId`, with client email and timestamp.

Indicator Logic:
- Merge `approvals.json` payloads into admin view. A post is marked with a green tick if any approval submission for that feed has `liked: true` for that post.
- Show a comment indicator if any approval submission has one or more comments for that post.

### State Additions

Editor/Client state extensions:
```javascript
// client.js / single-client.js
let clientIdentity = { email: '' };
let feedbackDraft = {
  gridComment: '',
  posts: [ /* { postId, liked, comments: [{ id, text, timestamp }] } */ ]
};
```

### Workflow Summary
1. Client opens link → prompted for email → logged.
2. Client likes/comments on posts or grid → saved as draft.
3. Client reviews in panel → presses Send.
4. Draft is recorded as an approval submission.
5. Admin views the grid → sees green ticks (likes) and comment badges per post; can open approval entries.

### Implementation Notes
- Respect the 2MB body limit; keep payloads compact.
- Use consistent ID generation (timestamp-based) for comments and approvals.
- Maintain a shared component library for UI elements to enforce 1:1 `UI Ref` fidelity.
- Consider debounced auto-save for feedback drafts to reduce friction.
