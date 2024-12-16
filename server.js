// Importing required packages
import express from 'express';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB Connected')).catch(err => console.error(err));

// Schemas and Models
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: '' }
});

const PostSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    createdAt: { type: Date, default: Date.now }
});

const GroupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    sentAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Post = mongoose.model('Post', PostSchema);
const Group = mongoose.model('Group', GroupSchema);
const Message = mongoose.model('Message', MessageSchema);

// Routes

// Home Route
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to the Social Media API' });
});

// User Registration
app.post('/users/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const hashedPassword = await argon2.hash(password);

        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// User Login
app.post('/users/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const validPassword = await argon2.verify(user.password, password);
        if (!validPassword) return res.status(400).json({ message: 'Invalid password' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({
                id: user._id,
                username: user.username,
                email: user.email,
                profilePic: user.profilePic,
                token: token
        });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get All Users
app.get('/users', async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Exclude passwords from response
        res.status(200).json(users);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Create Post
app.post('/posts', async (req, res) => {
    const { author, content } = req.body;
    try {
        const newPost = new Post({
            author,
            content
        });
        await newPost.save();
        res.status(201).json(newPost);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get Posts
app.get('/posts', async (req, res) => {
    try {
        const posts = await Post.find().populate('author', 'username profilePic');
        res.status(200).json(posts);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Create Group
app.post('/groups', async (req, res) => {
    const { name, description, members } = req.body;
    try {
        const newGroup = new Group({
            name,
            description,
            members
        });
        await newGroup.save();
        res.status(201).json(newGroup);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get Group Posts
app.get('/groups/:groupId/posts', async (req, res) => {
    const { groupId } = req.params;
    try {
        const groupPosts = await Post.find({ group: groupId }).populate('author', 'username profilePic');
        res.status(200).json(groupPosts);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Create Group Post
app.post('/groups/:groupId/posts', async (req, res) => {
    const { groupId } = req.params;
    const { author, content } = req.body;
    try {
        const newGroupPost = new Post({
            author,
            content,
            group: groupId
        });
        await newGroupPost.save();
        res.status(201).json(newGroupPost);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Private Messaging
app.post('/messages', async (req, res) => {
    const { sender, receiver, content } = req.body;
    try {
        const newMessage = new Message({
            sender,
            receiver,
            content
        });
        await newMessage.save();
        res.status(201).json(newMessage);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
