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

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`),
);
console.log(JWKS);

async function validateToken(req, res, next) {
  const authHeaders = req?.headers.authorization;
  if(!authHeaders){
    return res.status(401).json({message:"unauthorized"})
  }
  const token = authHeaders?.split(' ')[1];
  console.log(token, 'from backend bolci')
  try {
    const { payload } = await jwtVerify(token, JWKS);
    console.log(payload);
    next();
  } catch (error) {
    console.error("Token validation failed:", error);
    throw error;
  }
}

async function run() {
  try {
    await client.connect();

    const database = client.db("monteraDB");
    const courseCollection = database.collection("courses");

    app.get("/featuredCourses", async (req, res) => {
      const result = await courseCollection.find().limit(4).toArray();
      res.send(result);
    });

    app.get("/courses", async (req, res) => {
      try {
        const { title } = req.query;
        let query = {};

        if (title) {
          query.title = { $regex: title, $options: "i" };
        }

        const result = await courseCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Server error while fetching courses" });
      }
    });
    app.get("/courses/:id", validateToken, async (req, res) => {
      const courseId = req.params.id;
      const query = { _id: new ObjectId(courseId) };
      const result = await courseCollection.findOne(query);
      res.send(result);
    });

    app.post("/courses",validateToken, async (req, res) => {
      try {
        const result = await courseCollection.insertOne(req.body);
        res.status(201).json({ success: true, insertedId: result.insertedId });
      } catch (error) {
        res.status(500).json({ message: "Database insertion failed!" });
      }
    });
    app.get("/api/courses", async (req, res) => {
      try {
        const { title } = req.query;
        let query = {};

        if (title) {
          query.title = { $regex: title, $options: "i" };
        }

        const courses = await courseCollection.find(query).toArray();

        res.status(200).json(courses);
      } catch (error) {
        res
          .status(500)
          .json({ message: "Server error while fetching courses" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
