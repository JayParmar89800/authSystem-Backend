import AppDataSource from "../config/data-source.js";
import User from "../entities/User.js";

const userRepository = AppDataSource.getRepository(User);

export default userRepository;
