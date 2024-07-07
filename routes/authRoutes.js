const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const prisma = require("../config/prisma");
const { body, validationResult } = require("express-validator");

router.post(
  "/register",
  [
    body("firstName").notEmpty().withMessage("First name is required"),
    body("lastName").notEmpty().withMessage("Last name is required"),
    body("email").isEmail().withMessage("Invalid email").notEmpty(),
    body("password")
      .isLength({ min: 5 })
      .withMessage("Password must be at least 5 characters long"),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (errors.errors.length > 0) {
      const extractedErrorsArray = errors.errors.map((error) => {
        const { path, msg } = error;
        return { path, msg };
      });

      if (extractedErrorsArray.length > 0) {
        const extractedErrors = extractedErrorsArray.map((error) => ({
          field: error.path,
          message: error.msg,
        }));

        return res.status(422).json({
          errors: extractedErrors,
        });
      }
    }

    const { firstName, lastName, email, password, phone } = req.body;
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(422).json({
          errors: [{ field: "email", message: "Email already exists" }],
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email,
          password: hashedPassword,
          phone,
          organisations: {
            create: {
              organisation: {
                create: {
                  name: `${firstName}'s Organisation`,
                  description: "",
                },
              },
            },
          },
        },
      });

      const jwtPayload = { email: user.email };
      const accessToken = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRY,
      });

      res.status(201).json({
        status: "success",
        message: "Registration successful",
        data: {
          accessToken,
          user: {
            userId: user.userId,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
          },
        },
      });
    } catch (error) {
      console.log(error);
      res.status(422).json({
        status: "Bad request",
        message: "Registration unsuccessful",
        statusCode: 400,
      });
    }
  }
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Invalid email").notEmpty(),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (errors.errors.length > 0) {
      const extractedErrorsArray = errors.errors.map((error) => {
        const { path, msg } = error;
        return { path, msg };
      });

      if (extractedErrorsArray.length > 0) {
        const extractedErrors = extractedErrorsArray.map((error) => ({
          field: error.path,
          message: error.msg,
        }));

        return res.status(422).json({
          errors: extractedErrors,
        });
      }
    }

    const { email, password } = req.body;
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({
          status: "Bad request",
          message: "Authentication failed",
          statusCode: 401,
        });
      }

      const jwtPayload = { email: user.email };
      const accessToken = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRY,
      });

      res.status(200).json({
        status: "success",
        message: "Login successful",
        data: {
          accessToken,
          user: {
            userId: user.userId,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
          },
        },
      });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .json({ status: "error", message: "Internal server error" });
    }
  }
);

module.exports = router;
