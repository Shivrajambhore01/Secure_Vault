import { MongoClient } from "mongodb";
import dotenv from "dotenv";

import dns from "dns";
dotenv.config();

// Fix for querySrv ECONNREFUSED issues on some networks
dns.setServers(['8.8.8.8', '8.8.4.4']);

if (!process.env.MONGODB_URI) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
    let globalWithMongo = global as typeof globalThis & {
        _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
        client = new MongoClient(uri, options);
        globalWithMongo._mongoClientPromise = client.connect();
    }
    clientPromise = globalWithMongo._mongoClientPromise;
} else {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
}

clientPromise.then(() => {
    console.log("Successfully connected to MongoDB Atlas");
}).catch((err) => {
    console.error("Failed to connect to MongoDB Atlas:", err.message);
});

export default clientPromise;
