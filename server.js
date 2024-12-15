// Importing required packages
import express from 'express';
import mongoose from 'mongoose';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import multer from 'multer';
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
    images: [{ type: String }],
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

// Authentication middleware
const authenticate = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: 'Access denied' });

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ message: 'Invalid token' });
    }
};

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
        res.status(200).json({ token });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Create Post
app.post('/posts', authenticate, async (req, res) => {
    const { content, images } = req.body;
    try {
        const newPost = new Post({
            author: req.user.id,
            content,
            images
        });
        await newPost.save();
        res.status(201).json(newPost);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get Posts
app.get('/posts', authenticate, async (req, res) => {
    try {
        const posts = await Post.find().populate('author', 'username profilePic');
        res.status(200).json(posts);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Create Group
app.post('/groups', authenticate, async (req, res) => {
    const { name, description } = req.body;
    try {
        const newGroup = new Group({
            name,
            description,
            members: [req.user.id]
        });
        await newGroup.save();
        res.status(201).json(newGroup);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get Group Posts
app.get('/groups/:groupId/posts', authenticate, async (req, res) => {
    const { groupId } = req.params;
    try {
        const groupPosts = await Post.find({ group: groupId }).populate('author', 'username profilePic');
        res.status(200).json(groupPosts);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Create Group Post
app.post('/groups/:groupId/posts', authenticate, async (req, res) => {
    const { groupId } = req.params;
    const { content, images } = req.body;
    try {
        // Ensure user is a member of the group
        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (!group.members.includes(req.user.id)) {
            return res.status(403).json({ message: 'You are not a member of this group' });
        }

        const newGroupPost = new Post({
            author: req.user.id,
            content,
            images,
            group: groupId
        });
        await newGroupPost.save();
        res.status(201).json(newGroupPost);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Private Messaging
app.post('/messages', authenticate, async (req, res) => {
    const { receiver, content } = req.body;
    try {
        const newMessage = new Message({
            sender: req.user.id,
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
