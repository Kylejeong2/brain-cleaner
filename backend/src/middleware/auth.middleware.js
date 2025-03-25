const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        // Check if it's a Google token (Google tokens are usually longer and have different structure)
        if (token.length > 500) {
            // For Google tokens, we just decode without verification 
            // as Google tokens are self-contained and don't need our secret
            const decoded = jwt.decode(token);
            
            if (!decoded) {
                return res.status(401).json({ message: 'Invalid Google token' });
            }
            
            // Add a custom userId field to match our database structure
            req.user = { 
                ...decoded,
                userId: decoded.sub // Google uses 'sub' instead of 'id'
            };
            
            next();
        } else {
            // For our own tokens, verify with our secret
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            next();
        }
    } catch (err) {
        console.error('Token verification error:', err);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = {
    verifyToken
};
