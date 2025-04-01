import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";
import User from "../entities/User.js"; // Import entity explicitly

dotenv.config();

const AppDataSource = new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [User], // Load all entity files
  synchronize: true, // Set to `false` in production
  logging: true, // Logs SQL queries
});

export default AppDataSource;
