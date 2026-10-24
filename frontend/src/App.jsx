import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./index.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const emptyBook = {
  title: "",
  author: "",
  category: "Fiction",
  isbn: "",
  totalCopies: 1,
};

export default function App() {
  const [books, setBooks] = useState([]);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState("Dashboard");
  const [bookForm, setBookForm] = useState(emptyBook);
  const [borrowForm, setBorrowForm] = useState({
    bookId: "",
    borrowerName: "",
    borrowerContact: "",
    dueDate: "",
  });
  const [editingId, setEditingId] = useState(null);
  const [showBookForm, setShowBookForm] = useState(false);
  const [showBorrowForm, setShowBorrowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [bookResponse, recordResponse] = await Promise.all([
        axios.get(`${API}/books`),
        axios.get(`${API}/borrowings`),
      ]);

      setBooks(Array.isArray(bookResponse.data) ? bookResponse.data : []);
      setRecords(
        Array.isArray(recordResponse.data) ? recordResponse.data : []
      );
    } catch (err) {
      setError(
        "Cannot connect to the server. Check that your backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const available = books.reduce(
    (sum, book) => sum + Number(book.availableCopies || 0),
    0
  );

  const borrowed = records.filter(
    (record) => record.status === "Borrowed"
  ).length;

  const overdue = records.filter(
    (record) =>
      record.status === "Borrowed" &&
      record.dueDate &&
      new Date(record.dueDate) < new Date()
  ).length;

  const filteredBooks = useMemo(() => {
    const term = search.trim().toLowerCase();

    return books.filter((book) =>
      [book.title, book.author, book.category, book.isbn]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [books, search]);

  const recentRecords = [...records].reverse().slice(0, 5);

  function openAddBook() {
    setEditingId(null);
    setBookForm(emptyBook);
    setShowBookForm(true);
  }

  function openEditBook(book) {
    setEditingId(book._id);
    setBookForm({
      title: book.title || "",
      author: book.author || "",
      category: book.category || "Fiction",
      isbn: book.isbn || "",
      totalCopies: book.totalCopies ?? 1,
    });
    setShowBookForm(true);
  }

  async function saveBook(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    try {
      const payload = {
        ...bookForm,
        totalCopies: Number(bookForm.totalCopies),
      };

      if (editingId) {
        await axios.put(`${API}/books/${editingId}`, payload);
        setNotice("Book updated successfully.");
      } else {
        await axios.post(`${API}/books`, payload);
        setNotice("Book added successfully.");
      }

      setShowBookForm(false);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save the book.");
    }
  }

  async function deleteBook(book) {
    if (!window.confirm(`Delete "${book.title}"?`)) return;

    setError("");
    setNotice("");

    try {
      await axios.delete(`${API}/books/${book._id}`);
      setNotice("Book deleted successfully.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete the book.");
    }
  }

  function openBorrowForm(book = null) {
    const firstAvailable = books.find(
      (item) => Number(item.availableCopies) > 0
    );

    setBorrowForm({
      bookId: book?._id || firstAvailable?._id || "",
      borrowerName: "",
      borrowerContact: "",
      dueDate: "",
    });
    setShowBorrowForm(true);
  }

  async function borrowBook(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    try {
      await axios.post(`${API}/borrowings`, borrowForm);
      setShowBorrowForm(false);
      setNotice("Book borrowed successfully.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not borrow the book.");
    }
  }

  async function returnBook(record) {
    setError("");
    setNotice("");

    try {
      await axios.patch(`${API}/borrowings/${record._id}/return`);
      setNotice("Book returned successfully.");
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || "Could not return the book.");
    }
  }

  function goToBooks() {
    setPage("Books");
    setSearch("");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">📚</span>
          <div>
            <h2>LibraryMS</h2>
            <p>Manage · Borrow · Read</p>
          </div>
        </div>

        <nav className="navigation">
          {[
            ["Dashboard", "▦"],
            ["Books", "▤"],
            ["Borrow Books", "↗"],
            ["Return Books", "↩"],
            ["Borrowing Records", "▣"],
          ].map(([name, icon]) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "active" : ""}`}
              onClick={() => {
                setPage(name);
                setSearch("");
                if (name === "Borrow Books") openBorrowForm();
              }}
            >
              <span>{icon}</span>
              {name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <span className="online-dot" />
          Library administrator
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-search">
            <span>⌕</span>
            <input
              placeholder="Search books by title or author..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                if (page === "Dashboard") setPage("Books");
              }}
            />
          </div>
          <div className="admin-chip">
            <span className="avatar">A</span>
            <span>Admin</span>
          </div>
        </header>

        <section className="content">
          <div className="welcome-row">
            <div>
              <p className="eyebrow">LIBRARY MANAGEMENT SYSTEM</p>
              <h1>
                {page === "Dashboard" ? "Welcome back, Admin!" : page}
              </h1>
              <p className="muted">
                Manage your library and keep every book in its place.
              </p>
            </div>
            <div className="today-chip">
              <span>◷</span>
              {new Date().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>

          {error && (
            <div className="message error-message">
              {error}
              <button onClick={() => setError("")}>×</button>
            </div>
          )}

          {notice && (
            <div className="message success-message">
              {notice}
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}

          {loading ? (
            <div className="loading-panel">
              <div className="spinner" />
              <p>Loading your library...</p>
            </div>
          ) : (
            <>
              {page === "Dashboard" && (
                <>
                  <div className="stats-grid">
                    <StatCard
                      icon="▤"
                      label="Book Titles"
                      value={books.length}
                      color="blue"
                    />
                    <StatCard
                      icon="✓"
                      label="Available Copies"
                      value={available}
                      color="green"
                    />
                    <StatCard
                      icon="↗"
                      label="Active Borrowings"
                      value={borrowed}
                      color="orange"
                    />
                    <StatCard
                      icon="!"
                      label="Overdue Books"
                      value={overdue}
                      color="red"
                    />
                  </div>

                  <div className="section-heading">
                    <div>
                      <h2>Quick actions</h2>
                      <p className="muted">Common library tasks, all in one place.</p>
                    </div>
                  </div>

                  <div className="quick-grid">
                    <QuickCard
                      icon="＋"
                      title="Add a book"
                      text="Expand your collection"
                      button="Add new book"
                      color="blue"
                      onClick={openAddBook}
                    />
                    <QuickCard
                      icon="⌕"
                      title="Find a book"
                      text="Search your inventory"
                      button="Browse books"
                      color="green"
                      onClick={goToBooks}
                    />
                    <QuickCard
                      icon="↗"
                      title="Borrow a book"
                      text="Register a new borrowing"
                      button="Issue a book"
                      color="orange"
                      onClick={() => openBorrowForm()}
                    />
                    <QuickCard
                      icon="↩"
                      title="Return a book"
                      text="Update a borrowing record"
                      button="Manage returns"
                      color="purple"
                      onClick={() => setPage("Return Books")}
                    />
                  </div>

                  <div className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Recently added books</h2>
                        <p className="muted">A quick look at your collection.</p>
                      </div>
                      <button className="text-button" onClick={goToBooks}>
                        View all →
                      </button>
                    </div>
                    <BookTable
                      books={books.slice(-5).reverse()}
                      onEdit={openEditBook}
                      onDelete={deleteBook}
                      onBorrow={openBorrowForm}
                    />
                  </div>
                </>
              )}

              {page === "Books" && (
                <div className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Book inventory</h2>
                      <p className="muted">
                        {filteredBooks.length} book titles found
                      </p>
                    </div>
                    <button className="primary-button" onClick={openAddBook}>
                      + Add book
                    </button>
                  </div>

                  <div className="filter-bar">
                    <span>⌕</span>
                    <input
                      placeholder="Search title, author, category or ISBN..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    {search && (
                      <button
                        className="text-button"
                        onClick={() => setSearch("")}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <BookTable
                    books={filteredBooks}
                    onEdit={openEditBook}
                    onDelete={deleteBook}
                    onBorrow={openBorrowForm}
                  />
                </div>
              )}

              {page === "Borrow Books" && (
                <div className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Issue a book</h2>
                      <p className="muted">
                        Register a borrower and select an available book.
                      </p>
                    </div>
                    <button
                      className="primary-button"
                      onClick={() => openBorrowForm()}
                    >
                      + New borrowing
                    </button>
                  </div>
                  <BookTable
                    books={books.filter(
                      (book) => Number(book.availableCopies) > 0
                    )}
                    onEdit={openEditBook}
                    onDelete={deleteBook}
                    onBorrow={openBorrowForm}
                  />
                </div>
              )}

              {(page === "Return Books" ||
                page === "Borrowing Records") && (
                <div className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        {page === "Return Books"
                          ? "Books to return"
                          : "Borrowing history"}
                      </h2>
                      <p className="muted">
                        Track borrowers, due dates and return status.
                      </p>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={loadData}
                    >
                      ↻ Refresh
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Book</th>
                          <th>Borrower</th>
                          <th>Due date</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records
                          .filter(
                            (record) =>
                              page !== "Return Books" ||
                              record.status === "Borrowed"
                          )
                          .filter((record) => {
                            const term = search.toLowerCase();
                            return (
                              (record.book?.title || "")
                                .toLowerCase()
                                .includes(term) ||
                              (record.borrowerName || "")
                                .toLowerCase()
                                .includes(term)
                            );
                          })
                          .map((record) => {
                            const isOverdue =
                              record.status === "Borrowed" &&
                              record.dueDate &&
                              new Date(record.dueDate) < new Date();

                            return (
                              <tr key={record._id}>
                                <td className="book-title">
                                  {record.book?.title || record.bookTitle || "Book"}
                                </td>
                                <td>
                                  <div>{record.borrowerName}</div>
                                  <small>{record.borrowerContact}</small>
                                </td>
                                <td>
                                  {record.dueDate
                                    ? new Date(record.dueDate).toLocaleDateString()
                                    : "—"}
                                </td>
                                <td>
                                  <span
                                    className={`status ${
                                      record.status === "Returned"
                                        ? "status-available"
                                        : isOverdue
                                        ? "status-overdue"
                                        : "status-borrowed"
                                    }`}
                                  >
                                    {record.status === "Returned"
                                      ? "Returned"
                                      : isOverdue
                                      ? "Overdue"
                                      : "Borrowed"}
                                  </span>
                                </td>
                                <td>
                                  {record.status === "Borrowed" ? (
                                    <button
                                      className="small-button return-button"
                                      onClick={() => returnBook(record)}
                                    >
                                      Return
                                    </button>
                                  ) : (
                                    <span className="muted">Completed</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                    {records.length === 0 && (
                      <EmptyState text="No borrowing records yet." />
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <footer>
            <span>📚 Library Management System</span>
            <span>Built with the MERN Stack</span>
          </footer>
        </section>
      </main>

      {showBookForm && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={saveBook}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">BOOK INVENTORY</p>
                <h2>{editingId ? "Edit book" : "Add a new book"}</h2>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowBookForm(false)}
              >
                ×
              </button>
            </div>

            <label>
              Book title *
              <input
                required
                value={bookForm.title}
                onChange={(e) =>
                  setBookForm({ ...bookForm, title: e.target.value })
                }
                placeholder="e.g. Atomic Habits"
              />
            </label>
            <label>
              Author *
              <input
                required
                value={bookForm.author}
                onChange={(e) =>
                  setBookForm({ ...bookForm, author: e.target.value })
                }
                placeholder="Author name"
              />
            </label>
            <div className="form-row">
              <label>
                Category *
                <select
                  value={bookForm.category}
                  onChange={(e) =>
                    setBookForm({ ...bookForm, category: e.target.value })
                  }
                >
                  {[
                    "Fiction",
                    "Non-fiction",
                    "Science",
                    "Technology",
                    "Programming",
                    "Education",
                    "Fantasy",
                    "Self-Help",
                    "Other",
                  ].map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label>
                Total copies *
                <input
                  type="number"
                  min="1"
                  required
                  value={bookForm.totalCopies}
                  onChange={(e) =>
                    setBookForm({
                      ...bookForm,
                      totalCopies: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            <label>
              ISBN (optional)
              <input
                value={bookForm.isbn}
                onChange={(e) =>
                  setBookForm({ ...bookForm, isbn: e.target.value })
                }
                placeholder="Book ISBN"
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowBookForm(false)}
              >
                Cancel
              </button>
              <button className="primary-button" type="submit">
                {editingId ? "Save changes" : "Add book"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showBorrowForm && (
        <div className="modal-backdrop">
          <form className="modal" onSubmit={borrowBook}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">BORROWING</p>
                <h2>Issue a book</h2>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowBorrowForm(false)}
              >
                ×
              </button>
            </div>

            <label>
              Select book *
              <select
                required
                value={borrowForm.bookId}
                onChange={(e) =>
                  setBorrowForm({ ...borrowForm, bookId: e.target.value })
                }
              >
                <option value="">Choose a book</option>
                {books
                  .filter((book) => Number(book.availableCopies) > 0)
                  .map((book) => (
                    <option key={book._id} value={book._id}>
                      {book.title} ({book.availableCopies} available)
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Borrower's name *
              <input
                required
                value={borrowForm.borrowerName}
                onChange={(e) =>
                  setBorrowForm({
                    ...borrowForm,
                    borrowerName: e.target.value,
                  })
                }
                placeholder="Enter full name"
              />
            </label>
            <label>
              Contact number or email
              <input
                value={borrowForm.borrowerContact}
                onChange={(e) =>
                  setBorrowForm({
                    ...borrowForm,
                    borrowerContact: e.target.value,
                  })
                }
                placeholder="Borrower's contact"
              />
            </label>
            <label>
              Return due date *
              <input
                type="date"
                required
                min={new Date().toLocaleDateString("en-CA")}
                value={borrowForm.dueDate}
                onChange={(e) =>
                  setBorrowForm({ ...borrowForm, dueDate: e.target.value })
                }
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowBorrowForm(false)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={!books.some(
                  (book) =>
                    book._id === borrowForm.bookId &&
                    Number(book.availableCopies) > 0
                )}
              >
                Confirm borrowing
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-top">
        <span className="stat-icon">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function QuickCard({ icon, title, text, button, color, onClick }) {
  return (
    <div className="quick-card">
      <span className={`quick-icon ${color}`}>{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className={`quick-button ${color}`} onClick={onClick}>
        {button}
      </button>
    </div>
  );
}

function BookTable({ books, onEdit, onDelete, onBorrow }) {
  if (books.length === 0) {
    return <EmptyState text="No books found. Add your first book to get started." />;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Book</th>
            <th>Author</th>
            <th>Category</th>
            <th>Copies</th>
            <th>Available</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {books.map((book) => (
            <tr key={book._id}>
              <td>
                <div className="book-cell">
                  <span className="book-cover">▤</span>
                  <div>
                    <div className="book-title">{book.title}</div>
                    <small>{book.isbn || "No ISBN"}</small>
                  </div>
                </div>
              </td>
              <td>{book.author}</td>
              <td>{book.category}</td>
              <td>{book.totalCopies}</td>
              <td>{book.availableCopies}</td>
              <td>
                <span
                  className={`status ${
                    Number(book.availableCopies) > 0
                      ? "status-available"
                      : "status-borrowed"
                  }`}
                >
                  {Number(book.availableCopies) > 0 ? "Available" : "Borrowed"}
                </span>
              </td>
              <td>
                <div className="action-buttons">
                  <button
                    className="small-button edit-button"
                    title="Edit book"
                    onClick={() => onEdit(book)}
                  >
                    ✎
                  </button>
                  <button
                    className="small-button delete-button"
                    title="Delete book"
                    onClick={() => onDelete(book)}
                  >
                    ×
                  </button>
                  {Number(book.availableCopies) > 0 && (
                    <button
                      className="small-button borrow-button"
                      title="Borrow book"
                      onClick={() => onBorrow(book)}
                    >
                      ↗
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="empty-state">
      <span>📚</span>
      <p>{text}</p>
    </div>
  );
}