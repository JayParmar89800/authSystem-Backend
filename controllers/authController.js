import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../config/db.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { statusEnum } from "../config/enum.js";
import { Resend } from "resend";

dotenv.config();
const resend = new Resend(process.env.RESEND_API_KEY);

const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    const [existingUser] = await db
      .promise()
      .query("SELECT * FROM users WHERE email = ?", [email]);

    if (existingUser.length > 0) {
      return res.status(400).json({
        status: statusEnum.ERROR,
        message: "Email already registered.",
      });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);

    const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const query = `
        INSERT INTO users (first_name, last_name, email, password, role, verified)
        VALUES (?, ?, ?, ?, ?, 0)
      `;

    await db
      .promise()
      .query(query, [firstName, lastName, email, hashedPassword, role]);

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

    return res.status(201).json({
      status: statusEnum.SUCCESS,
      data: {
        token: verificationToken,
      },
      message: "User registered successfully. Please verify your email.",
    });
  } catch (error) {
    console.error("Registration Error:", error);
    return res.status(500).json({
      status: statusEnum.ERROR,
      message: "Something went wrong. Please try again.",
    });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const query = "UPDATE users SET verified = 1 WHERE email = ?";
    await db.promise().query(query, [decoded.email]);

    return res.status(200).json({
      status: statusEnum.SUCCESS,
      message: "Email verified successfully!",
    });
  } catch (error) {
    return res.status(400).json({
      status: statusEnum.ERROR,
      message: "Invalid or expired verification token.",
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [results] = await db
      .promise()
      .query("SELECT * FROM users WHERE email = ?", [email]);

    if (results.length === 0) {
      return res
        .status(400)
        .json({ status: statusEnum.ERROR, message: "User not found" });
    }

    const user = results[0];

    if (user?.role === "customer") {
      return res
        .status(400)
        .json({
          status: statusEnum.ERROR,
          message: "You are not allowed to login from here",
        });
    }

    if (!user.verified) {
      return res
        .status(400)
        .json({ status: statusEnum.ERROR, message: "Verify your email first" });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ status: statusEnum.ERROR, message: "Invalid credentials" });
    }

  

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
   delete user?.password
    return res.status(200).json({
      status: statusEnum.SUCCESS,
      message: "Login successfully",
      token: token,
      user: user,
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      status: statusEnum.ERROR,
      message: "Something went wrong. Please try again later.",
    });
  }
};

export default { register, verifyEmail, login };
