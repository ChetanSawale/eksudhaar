import app from "./server.js";

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.error(`EkSudhaar running on http://localhost:${PORT}`);
});
