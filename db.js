import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

const connectDb = (app) => {
    if (!MONGODB_URI) {
        console.error('FATAL ERROR: MONGODB_URI environment variable is not set.');
        process.exit(1);
    }

    mongoose
        .connect(
            MONGODB_URI
        )
        .then(() => {
            console.log("Connected to MongoDB");
            app.listen(PORT, () => {
                console.log(`Server is running on port ${PORT}`);
            });
        })
        .catch((err) => {
            console.error("Failed to connect to MongoDB", err);
        });
};

export { connectDb };
