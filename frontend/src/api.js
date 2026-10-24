// API layer.
// - If VITE_API_URL is set at build time, requests go to your real Express/MongoDB backend.
// - Otherwise (e.g. GitHub Pages), a browser-based demo backend is used. It mirrors the
//   routes and validation rules of backend/server.js and stores data in localStorage.
import realAxios from "axios";

const REAL_API = import.meta.env.VITE_API_URL;
const KEY = "library_ms_demo_v1";

const day = 24 * 60 * 60 * 1000;
const iso = (offset) => new Date(Date.now() + offset * day).toISOString();
let counter = 0;
const newId = () =>
  Date.now().toString(16) + (counter++).toString(16) + Math.random().toString(16).slice(2, 10);

function seed() {
  const mk = (title, author, category, isbn, total, avail) => ({
    _id: newId(), title, author, category, isbn,
    totalCopies: total, availableCopies: avail,
    createdAt: iso(-10), updatedAt: iso(-10),
  });
  const books = [
    mk("To Kill a Mockingbird", "Harper Lee", "Fiction", "9780061120084", 4, 3),
    mk("A Brief History of Time", "Stephen Hawking", "Science", "9780553380163", 3, 3),
    mk("Wings of Fire", "A. P. J. Abdul Kalam", "Biography", "9788173711466", 5, 4),
    mk("Clean Code", "Robert C. Martin", "Technology", "9780132350884", 2, 1),
    mk("Sapiens", "Yuval Noah Harari", "History", "9780062316097", 3, 3),
  ];
  const rec = (b, name, contact, borrowOff, dueOff) => ({
    _id: newId(), book: b._id, borrowerName: name, borrowerContact: contact,
    borrowDate: iso(borrowOff), dueDate: iso(dueOff), returnDate: null,
    status: "Borrowed", createdAt: iso(borrowOff), updatedAt: iso(borrowOff),
  });
  const borrowings = [
    rec(books[0], "Anjali Nair", "anjali@example.com", -6, 8),
    rec(books[2], "Rahul Menon", "9876543210", -20, -6),
    rec(books[3], "Fathima Noor", "fathima@example.com", -3, 11),
  ];
  return { books, borrowings };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  const fresh = seed();
  save(fresh);
  return fresh;
}

function save(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.response = { status, data: { message } };
  }
}

const ok = (data) => Promise.resolve({ data });
const fail = (status, message) => Promise.reject(new ApiError(status, message));
const populate = (db, r) => {
  const b = db.books.find((x) => x._id === r.book);
  return { ...r, book: b ? { _id: b._id, title: b.title, author: b.author, category: b.category } : null };
};

function route(method, url, body = {}) {
  const path = url.replace(/^.*\/api/, "").split("?")[0];
  const db = load();
  const now = new Date().toISOString();
  let m;

  if (method === "get" && path === "/books") {
    return ok([...db.books].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  if (method === "post" && path === "/books") {
    const copies = Number(body.totalCopies);
    if (!body.title?.trim() || !body.author?.trim() || !Number.isInteger(copies) || copies < 1)
      return fail(400, "Enter a title, author, and a valid number of copies.");
    const book = {
      _id: newId(), title: body.title.trim(), author: body.author.trim(),
      category: body.category || "Fiction", isbn: (body.isbn || "").trim(),
      totalCopies: copies, availableCopies: copies, createdAt: now, updatedAt: now,
    };
    db.books.push(book); save(db);
    return ok(book);
  }

  if ((m = path.match(/^\/books\/([^/]+)$/))) {
    const book = db.books.find((b) => b._id === m[1]);
    if (!book) return fail(404, "Book not found.");
    const active = db.borrowings.filter((r) => r.book === book._id && r.status === "Borrowed").length;

    if (method === "put") {
      const copies = Number(body.totalCopies);
      if (!body.title?.trim() || !body.author?.trim() || !Number.isInteger(copies) || copies < 1)
        return fail(400, "Enter a title, author, and a valid number of copies.");
      if (copies < active)
        return fail(400, `At least ${active} total copies are required because books are currently borrowed.`);
      Object.assign(book, {
        title: body.title.trim(), author: body.author.trim(),
        category: body.category || "Fiction", isbn: (body.isbn || "").trim(),
        totalCopies: copies, availableCopies: copies - active, updatedAt: now,
      });
      save(db);
      return ok(book);
    }

    if (method === "delete") {
      if (active > 0) return fail(400, "Return all borrowed copies before deleting this book.");
      db.books = db.books.filter((b) => b._id !== book._id);
      db.borrowings = db.borrowings.filter((r) => r.book !== book._id);
      save(db);
      return ok({ message: "Book deleted successfully." });
    }
  }

  if (method === "get" && path === "/borrowings") {
    const list = [...db.borrowings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok(list.map((r) => populate(db, r)));
  }

  if (method === "post" && path === "/borrowings") {
    const { bookId, borrowerName, borrowerContact, dueDate } = body;
    if (!db.books.some((b) => b._id === bookId)) return fail(400, "Select a valid book.");
    if (!borrowerName?.trim() || !dueDate) return fail(400, "Borrower name and due date are required.");
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return fail(400, "Enter a valid due date.");
    const book = db.books.find((b) => b._id === bookId);
    if (book.availableCopies < 1) return fail(400, "Book not found or no copies are available.");
    book.availableCopies -= 1;
    const record = {
      _id: newId(), book: book._id, borrowerName: borrowerName.trim(),
      borrowerContact: (borrowerContact || "").trim(), borrowDate: now,
      dueDate: due.toISOString(), returnDate: null, status: "Borrowed",
      createdAt: now, updatedAt: now,
    };
    db.borrowings.push(record); save(db);
    return ok(populate(db, record));
  }

  if ((m = path.match(/^\/borrowings\/([^/]+)\/return$/)) && method === "patch") {
    const record = db.borrowings.find((r) => r._id === m[1] && r.status === "Borrowed");
    if (!record) return fail(404, "Active borrowing record not found.");
    const book = db.books.find((b) => b._id === record.book);
    if (!book) return fail(404, "Book not found.");
    record.status = "Returned"; record.returnDate = now; record.updatedAt = now;
    book.availableCopies += 1;
    save(db);
    return ok(populate(db, record));
  }

  return fail(404, "Route not found.");
}

const demo = {
  get: (url) => route("get", url),
  post: (url, body) => route("post", url, body),
  put: (url, body) => route("put", url, body),
  patch: (url, body) => route("patch", url, body),
  delete: (url) => route("delete", url),
};

export const API_BASE = REAL_API || "/api";
export default REAL_API ? realAxios : demo;
