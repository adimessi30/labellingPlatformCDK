const fs = require("fs");
const serviceAccountLocalPath = "./serviceAccountKey.json";
console.log("File exists ? = ", fs.existsSync(serviceAccountLocalPath));
