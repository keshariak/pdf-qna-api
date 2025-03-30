const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const axios = require("axios");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
// console.log(process.env.PORT)
// console.log(process.env.MONGO_URI)

// Middleware
// app.use(cors());
// OR allow specific origin
// app.use(cors({ 
//   origin: "https://pdf-qan-ui.vercel.app",
//   methods: 'GET,POST,PUT,DELETE',
//   allowedHeaders: 'Content-Type'
//  }));


app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://pdf-qan-ui.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer setup for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI);

const pdfSchema = new mongoose.Schema({ text: String });
const PDF = mongoose.model("PDF", pdfSchema);

// Google Gemini API Key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent";



app.get("/", async (req, res) => {
  res.json("This is working on port 5000");
});

// Upload and extract text from PDF
app.post("/upload", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const pdfData = await pdfParse(req.file.buffer);
    const newPDF = new PDF({ text: pdfData.text });
    await newPDF.save();

    res.json({ text: pdfData.text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ask questions about the PDF using Google Gemini
app.post("/ask", async (req, res) => {
    try {
      const { question } = req.body;
      if (!question) return res.status(400).json({ message: "Question is required" });
  
      // Get the latest uploaded PDF text
      const latestPDF = await PDF.findOne().sort({ _id: -1 });
      if (!latestPDF) return res.status(404).json({ message: "No PDF found" });
  
      const response = await axios.post(
        `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
        {
          contents: [{ role: "user", parts: [{ text: `The following is a document:\n\n${latestPDF.text}\n\nUser's question: ${question}` }] }]
        }
      );
  
      res.json({ answer: response.data.candidates[0].content.parts[0].text });
    } catch (error) {
      res.status(500).json({ error: error.response?.data || error.message });
    }
  });
  
  
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
