const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// ---------- DATABASE MODELS ----------

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: "Fiction",
    },
    isbn: {
      type: String,
      trim: true,
      default: "",
    },
    totalCopies: {
      type: Number,
      required: true,
      min: 1,
    },
    availableCopies: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

const borrowingSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },
    borrowerName: {
      type: String,
      required: true,
      trim: true,
    },
    borrowerContact: {
      type: String,
      default: "",
      trim: true,
    },
    borrowDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    returnDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["Borrowed", "Returned"],
      default: "Borrowed",
    },
  },
  { timestamps: true }
);

const Book = mongoose.model("Book", bookSchema);
const Borrowing = mongoose.model("Borrowing", borrowingSchema);

// ---------- HOME / HEALTH CHECK ----------

app.get("/", (req, res) => {
  res.json({
    message: "Library Management API is running!",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    database: mongoose.connection.readyState === 1
      ? "Connected"
      : "Disconnected",
  });
});

// ---------- BOOK ROUTES ----------

// Get all books and search by title or author
app.get("/api/books", async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    const books = await Book.find(filter).sort({ createdAt: -1 });
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch books." });
  }
});

// Add a book
app.post("/api/books", async (req, res) => {
  try {
    const { title, author, category, isbn, totalCopies } = req.body;
    const copies = Number(totalCopies);

    if (
      !title?.trim() ||
      !author?.trim() ||
      !Number.isInteger(copies) ||
      copies < 1
    ) {
      return res.status(400).json({
        message: "Enter a title, author, and a valid number of copies.",
      });
    }

    const book = await Book.create({
      title,
      author,
      category: category || "Fiction",
      isbn: isbn || "",
      totalCopies: copies,
      availableCopies: copies,
    });

    res.status(201).json(book);
  } catch (error) {
    res.status(500).json({ message: "Failed to add book." });
  }
});

// Update a book
app.put("/api/books/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: "Book not found." });
    }

    const { title, author, category, isbn, totalCopies } = req.body;
    const copies = Number(totalCopies);

    if (
      !title?.trim() ||
      !author?.trim() ||
      !Number.isInteger(copies) ||
      copies < 1
    ) {
      return res.status(400).json({
        message: "Enter a title, author, and a valid number of copies.",
      });
    }

    const activeBorrowings = await Borrowing.countDocuments({
      book: book._id,
      status: "Borrowed",
    });

    if (copies < activeBorrowings) {
      return res.status(400).json({
        message: `At least ${activeBorrowings} total copies are required because books are currently borrowed.`,
      });
    }

    book.title = title;
    book.author = author;
    book.category = category || "Fiction";
    book.isbn = isbn || "";
    book.totalCopies = copies;
    book.availableCopies = copies - activeBorrowings;

    await book.save();
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: "Failed to update book." });
  }
});

// Delete a book
app.delete("/api/books/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: "Book not found." });
    }

    const activeBorrowings = await Borrowing.countDocuments({
      book: book._id,
      status: "Borrowed",
    });

    if (activeBorrowings > 0) {
      return res.status(400).json({
        message: "Return all borrowed copies before deleting this book.",
      });
    }

    await Borrowing.deleteMany({ book: book._id });
    await book.deleteOne();

    res.json({ message: "Book deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete book." });
  }
});

// ---------- BORROWING ROUTES ----------

// Get all borrowing records, including book details
app.get("/api/borrowings", async (req, res) => {
  try {
    const records = await Borrowing.find()
      .populate("book", "title author category")
      .sort({ createdAt: -1 });

    res.json(records);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch borrowing records.",
    });
  }
});

// Borrow a book
app.post("/api/borrowings", async (req, res) => {
  try {
    const { bookId, borrowerName, borrowerContact, dueDate } = req.body;

    if (!mongoose.isValidObjectId(bookId)) {
      return res.status(400).json({ message: "Select a valid book." });
    }

    if (!borrowerName?.trim() || !dueDate) {
      return res.status(400).json({
        message: "Borrower name and due date are required.",
      });
    }

    const due = new Date(dueDate);

    if (Number.isNaN(due.getTime())) {
      return res.status(400).json({ message: "Enter a valid due date." });
    }

    const book = await Book.findOneAndUpdate(
      { _id: bookId, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
      { new: true }
    );

    if (!book) {
      return res.status(400).json({
        message: "Book not found or no copies are available.",
      });
    }

    try {
      const record = await Borrowing.create({
        book: book._id,
        borrowerName,
        borrowerContact: borrowerContact || "",
        dueDate: due,
      });

      await record.populate("book", "title author category");
      return res.status(201).json(record);
    } catch (error) {
      // Restore the copy if the borrowing record could not be saved.
      await Book.updateOne(
        { _id: book._id },
        { $inc: { availableCopies: 1 } }
      );
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      message: "Failed to borrow book.",
    });
  }
});

// Return a borrowed book
app.patch("/api/borrowings/:id/return", async (req, res) => {
  try {
    const record = await Borrowing.findOneAndUpdate(
      { _id: req.params.id, status: "Borrowed" },
      { $set: { status: "Returned", returnDate: new Date() } },
      { new: true }
    );

    if (!record) {
      return res.status(404).json({
        message: "Active borrowing record not found.",
      });
    }

    const book = await Book.findByIdAndUpdate(
      record.book,
      { $inc: { availableCopies: 1 } },
      { new: true }
    );

    if (!book) {
      // Restore the record's active status if the book is missing.
      await Borrowing.updateOne(
        { _id: record._id, status: "Returned" },
        { $set: { status: "Borrowed", returnDate: null } }
      );

      return res.status(404).json({ message: "Book not found." });
    }

    await record.populate("book", "title author category");
    res.json(record);
  } catch (error) {
    res.status(500).json({ message: "Failed to return book." });
  }
});

// ---------- START SERVER ----------

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from the .env file.");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Atlas connected successfully.");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();