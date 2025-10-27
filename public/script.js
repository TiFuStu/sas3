let allUsers = [];
let filteredUsers = [];

async function fetchUsers() {
  const app = document.getElementById("app");
  app.innerHTML =
    '<div class="loading"><div class="spinner"></div>Lade Benutzerdaten...</div>';

  try {
    const res = await fetch("/api/users");
    if (!res.ok) throw new Error("Failed to load users");
    const users = await res.json();

    allUsers = users;
    filteredUsers = users;
    updateUserCount();
    renderTable(filteredUsers);
  } catch (err) {
    app.innerHTML =
      '<div class="error">Fehler beim Laden der Benutzerdaten</div>';
    console.error(err);
  }
}

function updateUserCount() {
  const count = filteredUsers.length;
  document.getElementById("userCount").textContent =
    `${count} ${count === 1 ? "Benutzer" : "Benutzer"} gefunden`;
}

function renderTable(users) {
  const app = document.getElementById("app");

  if (!users || users.length === 0) {
    app.innerHTML = '<div class="no-data">Keine Benutzer gefunden</div>';
    return;
  }

  const keys = Object.keys(users[0]);
  const tableHtml = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        ${keys.map((k) => `<th>${k}</th>`).join("")}
                    </tr>
                </thead>
                <tbody>
                    ${users
                      .map(
                        (row) => `
                        <tr>
                            ${keys.map((k) => `<td>${row[k] == null ? "" : String(row[k])}</td>`).join("")}
                        </tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
    `;

  app.innerHTML = tableHtml;
}

function filterUsers() {
  const searchTerm = document.getElementById("searchBox").value.toLowerCase();

  if (!searchTerm) {
    filteredUsers = allUsers;
  } else {
    filteredUsers = allUsers.filter((user) => {
      return Object.values(user).some(
        (value) => value && value.toString().toLowerCase().includes(searchTerm),
      );
    });
  }

  updateUserCount();
  renderTable(filteredUsers);
}

function showAddForm() {
  document.getElementById("addForm").style.display = "block";
  document.getElementById("userName").focus();
}

function hideAddForm() {
  document.getElementById("addForm").style.display = "none";
  document.getElementById("userForm").reset();
}

async function addUser(userData) {
  try {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to add user");
    }

    const result = await response.json();
    console.log("User added:", result);

    // Form schließen und Daten neu laden
    hideAddForm();
    fetchUsers();

    alert("Benutzer wurde erfolgreich hinzugefügt!");
  } catch (err) {
    console.error("Add user error:", err);
    alert("Fehler beim Hinzufügen des Benutzers: " + err.message);
  }
}

// Event Listeners
document.getElementById("searchBox").addEventListener("input", filterUsers);

document.getElementById("userForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const userData = {
    user_name: formData.get("user_name"),
    useraccess: parseInt(formData.get("useraccess")),
  };

  addUser(userData);
});

fetchUsers();

function setupScrollSync() {
  const tableContainer = document.querySelector(".table-container");
  const horizontalScroll = document.getElementById("horizontalScroll");
  const scrollContent = document.getElementById("scrollContent");
  const table = document.querySelector("table");

  if (table && scrollContent) {
    scrollContent.style.width = table.scrollWidth + "px";

    horizontalScroll.addEventListener("scroll", function () {
      tableContainer.scrollLeft = this.scrollLeft;
    });

    tableContainer.addEventListener("scroll", function () {
      horizontalScroll.scrollLeft = this.scrollLeft;
    });
  }
}

function afterTableLoad() {
  setupScrollSync();
  window.addEventListener("resize", setupScrollSync);
}
