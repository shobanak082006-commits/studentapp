const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const session = require("express-session");
const cors = require("cors");
const bcrypt = require("bcrypt");

const app = express();

/* ===========================
   MIDDLEWARE
=========================== */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

app.use(session({
  secret: process.env.SESSION_SECRET || "sms-secret-key",
  resave: false,
  saveUninitialized: true
}));

app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

/* ===========================
   AUTH
=========================== */
function isLoggedIn(req, res, next) {
  if (req.session.admin) return next();
  res.redirect("/login.html");
}

/* ===========================
   ROOT
=========================== */
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

/* ===========================
   DB CONNECT (RENDER READY)
=========================== */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("DB Error:", err));

/* ===========================
   SCHEMA
=========================== */
const studentSchema = new mongoose.Schema({
  name: String,
  registerNo: { type: String, unique: true },
  phone: String,
  parentPhone: String,
  email: String,
  gender: String,
  fatherName: String,
  motherName: String,
  dob: String,
  bloodGroup: String,
  caste: String,
  religion: String,
  attendancePercentage: String,
  semesterPercentage: String,
  course: String,
  address: String,
  photo: String
});

const Student = mongoose.model("Student", studentSchema);

const adminSchema = new mongoose.Schema({
  phone: String,
  password: String
});

const Admin = mongoose.model("Admin", adminSchema);

/* ===========================
   CREATE ADMIN (RUN ONCE)
=========================== */
async function createAdmin() {
  const exist = await Admin.findOne({ phone: "admin" });
  if (!exist) {
    const hash = await bcrypt.hash("admin", 10);
    await Admin.create({ phone: "admin", password: hash });
    console.log("Admin created");
  }
}
createAdmin(); // First deploy ku ok

/* ===========================
   MULTER
=========================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

/* ===========================
   LOGIN
=========================== */
app.post("/login", async (req, res) => {
  const { phone, password } = req.body;

  try {
    const admin = await Admin.findOne({ phone });
    if (!admin) return res.send("Invalid Login");

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.send("Invalid Login");

    req.session.admin = true;
    res.redirect("/dashboard");

  } catch (err) {
    console.log(err);
    res.send("Error");
  }
});

/* ===========================
   DASHBOARD
=========================== */
app.get("/dashboard", isLoggedIn, (req, res) => {
  res.sendFile(__dirname + "/public/dashboard.html");
});

/* ===========================
   LOGOUT
=========================== */
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

/* ===========================
   ADD STUDENT
=========================== */
app.post("/add-student", upload.single("photo"), async (req, res) => {
  try {
    const reg = req.body.registerNo;

    const exist = await Student.findOne({ registerNo: reg });
    if (exist) return res.send("Register Exists");

    const student = new Student({
      ...req.body,
      photo: req.file ? req.file.filename : ""
    });

    await student.save();
    res.redirect("/dashboard");

  } catch (err) {
    console.log(err);
    res.send("Error");
  }
});

/* ===========================
   GET STUDENT
=========================== */
app.get("/student/:regNo", async (req, res) => {
  try {
    const data = await Student.findOne({ registerNo: req.params.regNo });
    if (!data) return res.json({ message: "Not Found" });
    res.json(data);
  } catch (err) {
    res.json({ message: "Error" });
  }
});

/* ===========================
   UPDATE STUDENT
=========================== */
app.put("/update-student/:regNo", upload.single("photo"), async (req, res) => {
  try {
    const regNo = req.params.regNo;

    const update = { ...req.body };

    if (req.file) {
      update.photo = req.file.filename;
    }

    await Student.findOneAndUpdate({ registerNo: regNo }, update);

    res.json({ message: "Updated Successfully" });

  } catch (err) {
    console.log(err);
    res.json({ message: "Error" });
  }
});

/* ===========================
   DELETE STUDENT
=========================== */
app.delete("/delete-student/:regNo", async (req, res) => {
  try {
    await Student.findOneAndDelete({ registerNo: req.params.regNo });
    res.json({ message: "Deleted Successfully" });
  } catch (err) {
    res.json({ message: "Error" });
  }
});

/* ===========================
   SERVER START (RENDER READY)
=========================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on", PORT));
