const dotenv = require("dotenv");
dotenv.config();

describe("Local Environment", () => {
  test("Firebase service account should be available in env", () => {
    const firebaseServiceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    expect(firebaseServiceAccountKey).not.toBeUndefined();
    expect(firebaseServiceAccountKey).not.toBeNull();
  });
});
