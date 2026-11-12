
import Hyperwallet from "hyperwallet-sdk";
import "dotenv/config";

const client = new Hyperwallet({
  username: process.env.HYPERWALLET_USERNAME,
  password: process.env.HYPERWALLET_PASSWORD,
  programToken: process.env.HYPERWALLET_PROGRAM_TOKEN,
});

const recipient = {
  clientUserId: `corridorgate-sdk-test-${Date.now()}`,
  profileType: "INDIVIDUAL",
  firstName: "Daffyd",
  lastName: "Goliath",
  email: "testmail-1@hyperwallet.com",
  addressLine1: "123 Main Street",
  city: "Austin",
  stateProvince: "TX",
  country: "US",
  postalCode: "78701",
};

client.createUser(recipient, (errors, body, response) => {
  if (errors) {
    console.error("Hyperwallet SDK request failed:", errors);
    return;
  }

  console.log("HTTP status:", response?.statusCode);
  console.log("Recipient response:", body);
});
