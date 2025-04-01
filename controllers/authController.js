import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import userRepository from "../repositories/userRepository.js";
import dotenv from "dotenv";
import {Resend} from "resend"; 
import { statusEnum } from "../config/enum.js";

dotenv.config();
const resend = new Resend(process.env.RESEND_API_KEY);

const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    const existingUser = await userRepository.findOne({ where: { email } });

    if (existingUser) {
      return res.status(400).json({ message: "Email already registered.",status:statusEnum.ERROR });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1h" });

    const newUser = userRepository.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role,
      verified: false,
    });

    await userRepository.save(newUser);
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "Email Verification",
      html: `
        <div style="text-align: center; padding: 20px; font-family: Arial, sans-serif;">
          <h2>Verify Your Email</h2>
          <p>Thank you for signing up! Click the button below to verify your email.</p>
          <a href="${process.env.APP_URL}/auth/verify/${verificationToken}" 
            style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #ffffff; 
                   background: #007bff; text-decoration: none; border-radius: 5px;">
            Verify Email
          </a>
          <p>If the button above does not work, copy and paste this URL into your browser:</p>
          <p><a href="${process.env.APP_URL}/auth/verify/${verificationToken}">
            ${process.env.APP_URL}/auth/verify/${verificationToken}
          </a></p>
          <p style="color: #777; font-size: 12px;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    });
    return res.status(201).json({ message: "User registered successfully. Verify your email.", token: verificationToken,status:statusEnum.SUCCESS });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong.",status:statusEnum.ERROR });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await userRepository.findOne({ where: { email: decoded.email } });

    if (!user) {
      return res.status(400).json({ message: "Invalid token",status:statusEnum.ERROR });
    }

    user.verified = true;
    await userRepository.save(user);

    return res.status(200).json({ message: "Email verified successfully!",status:statusEnum.SUCCESS });
  } catch (error) {
    return res.status(400).json({ message: "Invalid or expired verification token.",status:statusEnum.ERROR });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userRepository.findOne({ where: { email } });
   
    if (!user) {
      return res.status(400).json({ message: "User not found" ,status:statusEnum.ERROR});
    }
    if (user?.role=="customer") {
      return res.status(400).json({ message: "You are not allowed to login from here" ,status:statusEnum.ERROR});
    }
    if (!user.verified) {
      return res.status(400).json({ message: "Verify your email first",status:statusEnum.ERROR });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" ,status:statusEnum.ERROR});
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });

    return res.status(200).json({ message: "Login successful", token,status:statusEnum.SUCCESS });
  } catch (error) {
    return res.status(500).json({ message: "Something went wrong.",status:statusEnum.ERROR });
  }
};

export default { register, verifyEmail, login };
