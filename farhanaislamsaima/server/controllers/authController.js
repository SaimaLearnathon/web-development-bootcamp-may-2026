const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function makePassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
    .toString('hex');

  return `${salt}:${hash}`;
}

function checkPassword(password, savedPassword) {
  const [salt, oldHash] = savedPassword.split(':');
  const newHash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
    .toString('hex');

  return oldHash === newHash;
}

function cleanUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email
  };
}

async function registerUser(req, res) {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please fill all fields' });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: 'Password should be at least 6 characters' });
  }

  try {
    const emailText = email.toLowerCase();
    const oldUser = await User.findOne({ email: emailText });

    if (oldUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const user = new User({
      name,
      email: emailText,
      password: makePassword(password)
    });

    await user.save();

    res.status(201).json({
      message: 'Account created',
      user: cleanUser(user)
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Could not register right now' });
  }
}

async function loginUser(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !user.password || !checkPassword(password, user.password)) {
      return res.status(400).json({ message: 'Wrong email or password' });
    }

    res.json({
      message: 'Logged in',
      user: cleanUser(user)
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Could not login right now' });
  }
}

async function googleLogin(req, res) {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ message: 'Google credential is required' });
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ message: 'Google login is not configured' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const email = payload.email?.toLowerCase();

    if (!email || !payload.email_verified) {
      return res.status(400).json({ message: 'Google email is not verified' });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        name: payload.name || email.split('@')[0],
        email,
        authProvider: 'google',
        googleId: payload.sub
      });
      await user.save();
    } else {
      user.authProvider = user.authProvider || 'google';
      user.googleId = user.googleId || payload.sub;
      await user.save();
    }

    res.json({
      message: 'Logged in with Google',
      user: cleanUser(user)
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({ message: 'Google login failed' });
  }
}

module.exports = {
  googleLogin,
  registerUser,
  loginUser
};
