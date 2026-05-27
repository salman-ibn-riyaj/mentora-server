const express = require("express");
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const port = process.env.PORT || 8000;
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const uri = process.env.MONGODB_URI;

// মঙ্গোডিবি ক্লায়েন্ট ইনিশিয়ালাইজেশন
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ডাটাবেজ এবং কালেকশন রেফারেন্স (গ্লোবালি রাখা হলো যাতে সব রাউট সরাসরি পায়)
const database = client.db("monteraDB");
const courseCollection = database.collection("courses");

// ডাটাবেজ কানেকশন হ্যান্ডেল করার জন্য একটি মিডলওয়্যার
let isConnected = false;
async function connectDB(req, res, next) {
  if (!isConnected) {
    try {
      await client.connect();
      isConnected = true;
      console.log("MongoDB Connected Successfully in Vercel!");
    } catch (error) {
      console.error("MongoDB connection error:", error);
      return res.status(500).json({ message: "Database connection failed" });
    }
  }
  next();
}

// Better-Auth JWKS সেটআপ
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`),
);

// টোকেন ভ্যালিডেশন মিডলওয়্যার
async function validateToken(req, res, next) {
  const authHeaders = req?.headers?.authorization; // lowercase 'authorization'
  if (!authHeaders) {
    return res.status(401).json({ message: "unauthorized" });
  }
  const token = authHeaders.split(' ')[1];
  
  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error("Token validation failed:", error);
    return res.status(403).json({ message: "forbidden or invalid token" });
  }
}

// --- সব রাউট এখন রান ফাংশনের বাইরে স্বাধীনভাবে থাকবে ---

app.get("/", (req, res) => {
  res.send("Hello World! Montera Server is running.");
});

app.get("/featuredCourses", connectDB, async (req, res) => {
  try {
    const result = await courseCollection.find().limit(4).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: "Error fetching featured courses" });
  }
});

app.get("/courses", connectDB, async (req, res) => {
  try {
    const { title } = req.query;
    let query = {};
    if (title) {
      query.title = { $regex: title, $options: "i" };
    }
    const result = await courseCollection.find(query).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: "Server error while fetching courses" });
  }
});

app.get("/courses/:id", validateToken, connectDB, async (req, res) => {
  try {
    const courseId = req.params.id;
    const query = { _id: new ObjectId(courseId) };
    const result = await courseCollection.findOne(query);
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: "Error fetching course details" });
  }
});

app.post("/courses", connectDB, validateToken, async (req, res) => {
  try {
    const result = await courseCollection.insertOne(req.body);
    res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Database insertion failed!" });
  }
});

app.get("/api/courses", connectDB, async (req, res) => {
  try {
    const { title } = req.query;
    let query = {};
    if (title) {
      query.title = { $regex: title, $options: "i" };
    }
    const courses = await courseCollection.find(query).toArray();
    res.status(200).json(courses);
  } catch (error) {
    res.status(500).json({ message: "Server error while fetching courses" });
  }
});

// লোকালহোস্টের জন্য লিসেনার সচল থাকবে
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
}

// ভার্সেলের জন্য এক্সপ্রেস অ্যাপ এক্সপোর্ট করা হলো
module.exports = app;