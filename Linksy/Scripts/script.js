
const feed = document.querySelector("#posts");
const postForm = document.querySelector("#post-form");
const postText = document.querySelector("#postText");
const postImageInput = document.querySelector("#post-image");
const imagePreview = document.querySelector("#image-preview");
const toast = document.querySelector("#toast");
const API_BASE = "http://127.0.0.1:8001/api";
const POSTS_PER_PAGE = 10;

let feedOffset = 0;
let feedHasMore = true;
let feedLoading = false;

const loadMoreButton = document.querySelector("#load-more-posts");
const feedStatus = document.querySelector("#feed-status");
let previewObjectUrl = null;

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let message = "Something went wrong.";
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // Keep the default error message.
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function uploadPost(formData) {
  const response = await fetch(`${API_BASE}/posts/with-image`, {
    method: "POST",
    credentials: "include",
    body: formData
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Could not upload post.");
  }

  return response.json();
}

const REQUESTS_KEY = "linksy_friend_requests";

const defaultRequests = [
  { name: "Emily Davis", initial: "E", mutual: 12 },
  { name: "Michael Brown", initial: "M", mutual: 8 },
  { name: "Jessica Wilson", initial: "J", mutual: 5 }
];

function loadData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    console.error(`Could not load ${key}:`, error);
    return fallback;
  }
}

let requests = loadData(REQUESTS_KEY, defaultRequests);

function saveRequests() {
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function postHTML(post) {
    const commentsHTML = (post.comments || []).map(comment => `
      <div class="comment">
        <strong>${escapeHTML(comment.author)}</strong>
        <p>${escapeHTML(comment.content)}</p>
        <small>${escapeHTML(formatDate(comment.created_at))}</small>
      </div>
    `).join("");

    return `
    <article class="card post" data-post-id="${post.id}">
      <div class="post-header">
        <span class="avatar">${escapeHTML((post.author || "?").charAt(0).toUpperCase())}</span>
        <div>
          <div class="post-author">${escapeHTML(post.author || "Linksy user")}</div>
          <div class="post-time">${escapeHTML(formatDate(post.created_at))}</div>
        </div>
      </div>

      <p class="post-text">${escapeHTML(post.content || "")}</p>

      ${post.image_url ? `
        <img
          class="post-image"
          src="${escapeHTML(post.image_url.startsWith("/")
            ? `http://127.0.0.1:8001${post.image_url}`
            : post.image_url)}"
          alt="Photo shared in a post"
          loading="lazy"
        />
      ` : ""}

      <div class="post-summary">
        👍 ${post.likes || 0} · ${(post.comments || []).length} comments
      </div>

      <div class="post-actions">
        <button class="like-button ${post.liked ? "liked" : ""}" data-action="like" type="button">
          ${post.liked ? "Unlike" : "Like"}
        </button>
        <button data-action="focus-comment" type="button">💬 Comment</button>
        <button class="delete-button" data-action="delete" type="button">
          Delete
        </button>
      </div>

      <div class="comment-list">${commentsHTML}</div>

      <form class="comment-area comment-form">
        <input name="comment" maxlength="500"
          placeholder="Write a comment..." aria-label="Write a comment">
        <button type="submit">Send</button>
      </form>
    </article>
  `;
}

function renderPosts(posts, append = false) {
  if (!feed) return;

  if (!posts.length && !append) {
    feed.innerHTML = `
      <div class="card empty-feed">
        <p>No posts yet. Be the first to share something!</p>
      </div>
    `;
    return;
  }

  const postsHTML = posts.map(postHTML).join("");
  if (append) {
    feed.insertAdjacentHTML("beforeend", postsHTML);
  } else {
    feed.innerHTML = postsHTML;
  }
}

async function loadPosts({ reset = false } = {}) {
  if (feedLoading) return;

  if (reset) {
    feedOffset = 0;
    feedHasMore = true;
    if (feed) feed.innerHTML = "";
  }

  if (!feedHasMore) return;

  feedLoading = true;
  if (loadMoreButton) {
    loadMoreButton.disabled = true;
    loadMoreButton.textContent = "Loading...";
  }
  if (feedStatus) feedStatus.textContent = "";

  try {
    const posts = await apiRequest(
      `/posts?limit=${POSTS_PER_PAGE}&offset=${feedOffset}`
    );

    renderPosts(posts, !reset && feedOffset > 0);
    feedOffset += posts.length;
    feedHasMore = posts.length === POSTS_PER_PAGE;

    if (!posts.length && feedOffset === 0) {
      renderPosts([]);
    }

    if (loadMoreButton) loadMoreButton.hidden = !feedHasMore;
    if (feedStatus && !feedHasMore) {
      feedStatus.textContent = "You're all caught up.";
    }
  } catch (error) {
    if (feedStatus) feedStatus.textContent = error.message;
    else if (feed) feed.innerHTML = `<p class="error-message">${escapeHTML(error.message)}</p>`;
  } finally {
    feedLoading = false;
    if (loadMoreButton) {
      loadMoreButton.disabled = false;
      loadMoreButton.textContent = "Load More";
    }
  }
}

loadMoreButton?.addEventListener("click", () => loadPosts());

function renderRequests() {
  const container = document.querySelector("#friendRequests");

  container.innerHTML = requests.length
    ? requests.map((request, index) => `
      <div class="request" data-request-index="${index}">
        <div class="post-header">
          <span class="avatar">${escapeHTML(request.initial)}</span>
          <div>
            <strong>${escapeHTML(request.name)}</strong>
            <small>${request.mutual} mutual friends</small>
          </div>
        </div>
        <div class="request-actions">
          <button class="confirm" data-request-action="confirm">Confirm</button>
          <button class="delete" data-request-action="delete">Delete</button>
        </div>
      </div>
    `).join("")
    : "<p>No pending friend requests.</p>";
}

postImageInput?.addEventListener("change", () => {
  const file = postImageInput.files[0];

  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }

  if (!file) {
    imagePreview.hidden = true;
    imagePreview.removeAttribute("src");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("Choose an image smaller than 5 MB.");
    postImageInput.value = "";
    imagePreview.hidden = true;
    return;
  }

  previewObjectUrl = URL.createObjectURL(file);
  imagePreview.src = previewObjectUrl;
  imagePreview.hidden = false;
});

postForm.addEventListener("submit", async event => {
  event.preventDefault();

  const content = postText.value.trim();
  const imageFile = postImageInput?.files[0];
  if (!content && !imageFile) {
    alert("Write something or select an image.");
    return;
  }

  try {
    if (imageFile) {
      const formData = new FormData();
      formData.append("content", content);
      formData.append("image", imageFile);
      await uploadPost(formData);
    } else {
      await apiRequest("/posts", {
        method: "POST",
        body: JSON.stringify({ content })
      });
    }

    postForm.reset();
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }
    imagePreview.hidden = true;
    imagePreview.removeAttribute("src");
    await loadPosts({ reset: true });
    showToast("Your post was published!");
  } catch (error) {
    showToast(error.message);
  }
});

feed.addEventListener("click", async event => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const article = actionButton.closest("[data-post-id]");
  if (!article) return;

  const postId = article.dataset.postId;
  const action = actionButton.dataset.action;

  if (action === "like") {
    try {
      await apiRequest(`/posts/${postId}/like`, {
        method: "POST"
      });
      await loadPosts({ reset: true });
    } catch (error) {
      showToast(error.message);
    }
  }

  if (action === "focus-comment") {
    article.querySelector('input[name="comment"]').focus();
  }

  if (action === "delete") {
    const confirmed = confirm("Are you sure you want to delete this post?");
    if (!confirmed) return;

    try {
      await apiRequest(`/posts/${postId}`, {
        method: "DELETE"
      });

      await loadPosts({ reset: true });
    } catch (error) {
      alert(error.message);
    }
  }
});

feed.addEventListener("submit", async event => {
  const form = event.target.closest(".comment-form");
  if (!form) return;

  event.preventDefault();

  const article = form.closest("[data-post-id]");
  const input = form.querySelector('[name="comment"]');
  const comment = input.value.trim();

  if (!comment || !article) return;

  try {
    await apiRequest(`/posts/${article.dataset.postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content: comment })
    });
    form.reset();
    await loadPosts({ reset: true });
    showToast("Comment added.");
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector("#searchInput").addEventListener("input", event => {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll("#posts [data-post-id]").forEach(post => {
    post.hidden = !post.textContent.toLowerCase().includes(query);
  });
});

document.querySelector("#friendRequests").addEventListener("click", event => {
  const button = event.target.closest("[data-request-action]");
  if (!button) return;

  const requestElement = button.closest("[data-request-index]");
  const index = Number(requestElement.dataset.requestIndex);
  const request = requests[index];

  if (!request) return;

  const action = button.dataset.requestAction;
  requests.splice(index, 1);
  saveRequests();
  renderRequests();

  showToast(action === "confirm"
    ? `You are now connected with ${request.name}.`
    : `Request from ${request.name} removed.`);
});

document.querySelector("#seeRequests").addEventListener("click", () => {
  showToast(`${requests.length} pending friend request(s).`);
});

document.querySelector("#createStory").addEventListener("click", () => {
  showToast("Story creation will be added in a future version.");
});

document.querySelector("#feelingButton").addEventListener("click", () => {
  postText.value += postText.value ? " 😊" : "😊";
  postText.focus();
});

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-button").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    const page = button.dataset.page;
    showToast(`${page.charAt(0).toUpperCase() + page.slice(1)} section selected.`);
  });
});

document.querySelectorAll("[data-story]").forEach(button => {
  button.addEventListener("click", () => {
    showToast(`${button.dataset.story}'s story selected.`);
  });
});

renderRequests();
loadPosts({ reset: true });

const authPanel = document.querySelector("#authPanel");
const authForm = document.querySelector("#authForm");
const authTitle = document.querySelector("#authTitle");
const authDescription = document.querySelector("#authDescription");
const authName = document.querySelector("#authName");
const nameLabel = document.querySelector("#nameLabel");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authSubmit = document.querySelector("#authSubmit");
const authMessage = document.querySelector("#authMessage");
const switchAuth = document.querySelector("#switchAuth");

const authButtons = document.querySelector("#authButtons");
const profileArea = document.querySelector("#profileArea");
const profileName = document.querySelector("#profileName");
const profileAvatar = document.querySelector("#profileAvatar");

let authMode = "login";

function showAuthMessage(message, type = "") {
  authMessage.textContent = message;
  authMessage.className = type;
}

function openAuth(mode) {
  authMode = mode;
  authPanel.hidden = false;
  authForm.reset();
  showAuthMessage("");

  const registering = mode === "register";

  authTitle.textContent = registering
    ? "Create your Linksy account"
    : "Log in to Linksy";

  authDescription.textContent = registering
    ? "Join Linksy and connect with others."
    : "Welcome back! Enter your account details.";

  authName.hidden = !registering;
  nameLabel.hidden = !registering;
  authName.required = registering;

  authPassword.autocomplete = registering
    ? "new-password"
    : "current-password";

  authSubmit.textContent = registering
    ? "Create account"
    : "Log in";

  switchAuth.textContent = registering
    ? "Already have an account? Log in"
    : "Don't have an account? Create one";
}

document.querySelector("#openLogin").addEventListener("click", () => {
  openAuth("login");
});

document.querySelector("#openRegister").addEventListener("click", () => {
  openAuth("register");
});

document.querySelector("#closeAuth").addEventListener("click", () => {
  authPanel.hidden = true;
});

switchAuth.addEventListener("click", () => {
  openAuth(authMode === "login" ? "register" : "login");
});

authForm.addEventListener("submit", async event => {
  event.preventDefault();

  const registering = authMode === "register";

  const payload = {
    email: authEmail.value.trim(),
    password: authPassword.value
  };

  if (registering) {
    payload.name = authName.value.trim();
  }

  authSubmit.disabled = true;
  authSubmit.textContent = "Please wait...";
  showAuthMessage("");

  try {
    const response = await fetch(
      `${API_BASE}/${registering ? "register" : "login"}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(payload)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.detail || "Authentication failed.");
    }

    if (registering) {
      authForm.reset();
      openAuth("login");
      showAuthMessage("Account created! Please log in.", "success");
    } else {
      await loadCurrentUser();
      await loadPosts({ reset: true });
      authPanel.hidden = true;
      showToast("Welcome to Linksy!");
    }
  } catch (error) {
    showAuthMessage(
      error.message || "Could not connect to the Linksy server.",
      "error"
    );
  } finally {
    authSubmit.disabled = false;
    authSubmit.textContent =
      authMode === "register" ? "Create account" : "Log in";
  }
});

async function loadCurrentUser() {
  try {
    const response = await fetch(`${API_BASE}/me`, {
      credentials: "include"
    });

    if (!response.ok) {
      showLoggedOutState();
      return;
    }

    const result = await response.json();
    const user = result.user;

    authButtons.hidden = true;
    profileArea.hidden = false;

    profileName.textContent = user.name;
    profileAvatar.textContent =
      user.name.trim().charAt(0).toUpperCase();

    postText.placeholder = `What's on your mind, ${user.name}?`;
    await loadPosts({ reset: true });
  } catch (error) {
    console.error("Could not check login status:", error);
  }
}

function showLoggedOutState() {
  authButtons.hidden = false;
  profileArea.hidden = true;
  profileName.textContent = "";
  profileAvatar.textContent = "R";
  postText.placeholder = "What's on your mind, Ronald?";
}

document.querySelector("#logoutButton").addEventListener("click", async () => {
  try {
    const response = await fetch(`${API_BASE}/logout`, {
      method: "POST",
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error("Logout failed.");
    }

    showLoggedOutState();
    await loadPosts({ reset: true });
    showToast("You have logged out.");
  } catch (error) {
    showToast(error.message);
  }
});

loadCurrentUser();

const profileSection = document.querySelector("#profile-section");
const profilePosts = document.querySelector("#profile-posts");
const profileForm = document.querySelector("#profile-form");

async function loadProfile() {
  try {
    const user = await apiRequest("/profile");

    document.querySelector("#profile-name").textContent =
      user.name || "Linksy User";
    document.querySelector("#profile-email").textContent = user.email || "";
    document.querySelector("#profile-bio").textContent =
      user.bio || "No bio added yet.";
    document.querySelector("#profile-avatar").textContent =
      (user.name || "?").charAt(0).toUpperCase();
    document.querySelector("#profile-bio-input").value = user.bio || "";

    const result = await apiRequest("/posts");
    const myPosts = (result || []).filter(post =>
      post.user_id === user.id || post.author_id === user.id
    );

    renderProfilePosts(myPosts);
  } catch (error) {
    showToast(error.message);
  }
}

function renderProfilePosts(posts) {
  if (!profilePosts) return;

  if (!posts.length) {
    profilePosts.innerHTML = "<p>You have not posted anything yet.</p>";
    return;
  }

  profilePosts.innerHTML = posts.map(post => `
    <article class="card post-card">
      <p>${escapeHTML(post.content || "")}</p>
      <small>${escapeHTML(formatDate(post.created_at))}</small>
    </article>
  `).join("");
}

document.querySelector("#open-profile-button")?.addEventListener(
  "click",
  async () => {
    if (!profileSection) return;

    profileSection.hidden = false;
    await loadProfile();
    profileSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
);

profileForm?.addEventListener("submit", async event => {
  event.preventDefault();

  const bio = document.querySelector("#profile-bio-input").value.trim();

  try {
    await apiRequest("/profile", {
      method: "PUT",
      body: JSON.stringify({ bio })
    });

    await loadProfile();
    showToast("Profile updated successfully.");
  } catch (error) {
    showToast(error.message);
  }
});

const friendsSection = document.querySelector("#friends-section");

async function loadFriends() {
  try {
    const requestsResult = await apiRequest("/friends/requests");
    const friends = await apiRequest("/friends");
    const incoming = document.querySelector("#incoming-requests");
    const outgoing = document.querySelector("#outgoing-requests");
    const friendsList = document.querySelector("#friends-list");

    incoming.innerHTML = requestsResult.incoming.length
      ? requestsResult.incoming.map(request => `
          <div class="friend-item">
            <strong>${escapeHTML(request.name || request.email)}</strong>
            <button data-request-id="${request.id}" data-action="accept" type="button">
              Accept
            </button>
            <button data-request-id="${request.id}" data-action="decline" type="button">
              Decline
            </button>
          </div>
        `).join("")
      : "<p>No incoming requests.</p>";

    outgoing.innerHTML = requestsResult.outgoing.length
      ? requestsResult.outgoing.map(request => `
          <div class="friend-item">
            ${escapeHTML(request.name || request.email)}
          </div>
        `).join("")
      : "<p>No sent requests.</p>";

    friendsList.innerHTML = friends.length
      ? friends.map(friend => `
          <div class="friend-item">
            ${escapeHTML(friend.name || friend.email)}
          </div>
        `).join("")
      : "<p>You have no friends yet.</p>";
  } catch (error) {
    showToast(error.message);
  }
}

function openFriendsSection() {
  if (!friendsSection) return;

  friendsSection.hidden = false;
  loadFriends();
  friendsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.querySelectorAll('[data-page="friends"]').forEach(button => {
  button.addEventListener("click", openFriendsSection);
});

friendsSection?.addEventListener("click", async event => {
  const button = event.target.closest("button[data-request-id]");
  if (!button) return;

  try {
    await apiRequest(
      `/friends/requests/${button.dataset.requestId}/respond?action=${button.dataset.action}`,
      { method: "POST" }
    );
    await loadFriends();
  } catch (error) {
    showToast(error.message);
  }
});

const discoverSection = document.querySelector("#discover-section");
const peopleSearchForm = document.querySelector("#people-search-form");
const peopleSearchInput = document.querySelector("#people-search-input");
const peopleSearchResults = document.querySelector("#people-search-results");
const peopleSearchMessage = document.querySelector("#people-search-message");

document.querySelector("#open-discover-button")?.addEventListener("click", () => {
  if (!discoverSection) return;

  discoverSection.hidden = false;
  peopleSearchInput?.focus();
  discoverSection.scrollIntoView({ behavior: "smooth", block: "start" });
});

peopleSearchForm?.addEventListener("submit", async event => {
  event.preventDefault();

  const query = peopleSearchInput.value.trim();

  if (query.length < 2) {
    peopleSearchMessage.textContent = "Enter at least 2 characters to search.";
    return;
  }

  peopleSearchMessage.textContent = "Searching...";
  peopleSearchResults.innerHTML = "";

  try {
    const users = await apiRequest(
      `/users/search?q=${encodeURIComponent(query)}`
    );

    if (!users.length) {
      peopleSearchMessage.textContent = "No matching users found.";
      return;
    }

    peopleSearchMessage.textContent = `${users.length} user(s) found.`;
    peopleSearchResults.innerHTML = users.map(user => `
      <article class="person-card">
        <div class="person-avatar">
          ${escapeHTML((user.name || "?").charAt(0).toUpperCase())}
        </div>

        <div class="person-info">
          <strong>${escapeHTML(user.name || "Linksy User")}</strong>
          <p>${escapeHTML(user.email || "")}</p>
        </div>

        <button
          type="button"
          data-action="send-friend-request"
          data-user-id="${user.id}"
        >
          Add Friend
        </button>
      </article>
    `).join("");
  } catch (error) {
    peopleSearchMessage.textContent = error.message;
  }
});

peopleSearchResults?.addEventListener("click", async event => {
  const button = event.target.closest(
    'button[data-action="send-friend-request"]'
  );

  if (!button) return;

  button.disabled = true;
  button.textContent = "Sending...";

  try {
    await apiRequest("/friends/request", {
      method: "POST",
      body: JSON.stringify({
        receiver_id: Number(button.dataset.userId)
      })
    });

    button.textContent = "Request Sent";
  } catch (error) {
    button.disabled = false;
    button.textContent = "Add Friend";
    showToast(error.message);
  }
});

const notificationsSection = document.querySelector("#notifications-section");
const notificationsList = document.querySelector("#notifications-list");
const notificationBadge = document.querySelector("#notification-badge");
const notificationsMessage = document.querySelector("#notifications-message");

function notificationText(notification) {
  const actor = notification.actor_name || "Someone";

  if (notification.notification_type === "friend_request") {
    return `${actor} sent you a friend request.`;
  }

  if (notification.notification_type === "friend_accepted") {
    return `${actor} accepted your friend request.`;
  }

  return "You have a new notification.";
}

async function loadNotificationCount() {
  try {
    const result = await apiRequest("/notifications/unread-count");
    notificationBadge.textContent = result.count;
    notificationBadge.hidden = result.count === 0;
  } catch {
    notificationBadge.hidden = true;
  }
}

async function loadNotifications() {
  try {
    const notifications = await apiRequest("/notifications");

    notificationsMessage.textContent = notifications.length
      ? ""
      : "You have no notifications.";

    notificationsList.innerHTML = notifications.map(item => `
      <article class="notification-item ${item.is_read ? "" : "unread"}">
        <p>${escapeHTML(notificationText(item))}</p>
        <small>${escapeHTML(formatDate(item.created_at))}</small>
        ${item.is_read
          ? ""
          : `<button type="button" data-notification-id="${item.id}" data-action="mark-read">
               Mark as read
             </button>`}
      </article>
    `).join("");

    await loadNotificationCount();
  } catch (error) {
    notificationsMessage.textContent = error.message;
  }
}

document.querySelector("#open-notifications-button")?.addEventListener(
  "click",
  async () => {
    if (!notificationsSection) return;

    notificationsSection.hidden = false;
    await loadNotifications();
    notificationsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
);

notificationsList?.addEventListener("click", async event => {
  const button = event.target.closest(
    'button[data-action="mark-read"]'
  );

  if (!button) return;

  try {
    await apiRequest(
      `/notifications/${button.dataset.notificationId}/read`,
      { method: "POST" }
    );
    await loadNotifications();
  } catch (error) {
    showToast(error.message);
  }
});

loadNotificationCount();

const messagesSection = document.querySelector("#messages-section");
const messageFriendsList = document.querySelector("#message-friends-list");
const conversationMessages = document.querySelector("#conversation-messages");
const conversationTitle = document.querySelector("#conversation-title");
const messageForm = document.querySelector("#message-form");
const messageInput = document.querySelector("#message-input");
const sendMessageButton = document.querySelector("#send-message-button");

let activeFriendId = null;

document.querySelector("#open-messages-button")?.addEventListener(
  "click",
  async () => {
    if (!messagesSection) return;

    messagesSection.hidden = false;
    await loadMessageFriends();
    messagesSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
);

async function loadMessageFriends() {
  try {
    const friends = await apiRequest("/friends");

    messageFriendsList.innerHTML = friends.length
      ? friends.map(friend => `
          <button
            type="button"
            class="message-friend-button"
            data-friend-id="${friend.id}"
            data-friend-name="${escapeHTML(friend.name || friend.email)}"
          >
            ${escapeHTML(friend.name || friend.email)}
          </button>
        `).join("")
      : "<p>Add friends to start messaging.</p>";
  } catch (error) {
    messageFriendsList.textContent = error.message;
  }
}

messageFriendsList?.addEventListener("click", async event => {
  const button = event.target.closest("[data-friend-id]");
  if (!button) return;

  activeFriendId = Number(button.dataset.friendId);
  conversationTitle.textContent = button.dataset.friendName;
  messageInput.disabled = false;
  sendMessageButton.disabled = false;
  await loadConversation();
});

async function loadConversation() {
  if (!activeFriendId) return;

  try {
    const messages = await apiRequest(`/messages/${activeFriendId}`);

    conversationMessages.innerHTML = messages.length
      ? messages.map(message => `
          <article class="message ${message.sender_id === activeFriendId ? "received" : "sent"}">
            <p>${escapeHTML(message.content)}</p>
            <small>${escapeHTML(formatDate(message.created_at))}</small>
          </article>
        `).join("")
      : "<p>No messages yet. Start the conversation.</p>";

    conversationMessages.scrollTop = conversationMessages.scrollHeight;
  } catch (error) {
    conversationMessages.textContent = error.message;
  }
}

messageForm?.addEventListener("submit", async event => {
  event.preventDefault();

  const content = messageInput.value.trim();
  if (!content || !activeFriendId) return;

  sendMessageButton.disabled = true;

  try {
    await apiRequest(`/messages/${activeFriendId}`, {
      method: "POST",
      body: JSON.stringify({ content })
    });

    messageInput.value = "";
    await loadConversation();
  } catch (error) {
    showToast(error.message);
  } finally {
    sendMessageButton.disabled = false;
  }
});